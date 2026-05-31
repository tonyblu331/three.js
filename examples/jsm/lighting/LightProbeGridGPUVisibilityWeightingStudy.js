import * as THREE from 'three/webgpu';
import { createLightProbeGridGPUReceiverDiagnostics } from './LightProbeGridGPUReceiverDiagnostics.js';
import { createLightProbeGridGPUShDiagnostics } from './LightProbeGridGPUShDiagnostics.js';
import {
	readLightProbeGridGPUProbeCoefficients,
	readLightProbeGridGPUVisibilityMoment
} from './lightprobegridgpu/LightProbeGridGPUProofReadback.js';
import { getLightProbeGridGPUProbeIndex } from './lightprobegridgpu/LightProbeGridGPUAtlas.js';

export function createLightProbeGridGPUVisibilityWeightingStudy( dependencies ) {

	const {
		_lightProbeContext,
		captureLeakRegionMetrics,
		createHarnessStateSnapshot,
		createProbeVisibilitySnapshot,
		evaluateIrradianceContract,
		restoreHarnessState,
		restoreProbeVisibilitySnapshot,
		roundMetric,
		applyProofBakeSettings
	} = dependencies;

	const inspectVisibilityWeightingAtLeakReceivers = async ( fixtureMode = 'thin-wall' ) => {

		const previousState = createHarnessStateSnapshot();
		const previousVisibility = createProbeVisibilitySnapshot();
		const resolution = 4;
		const resolutionMinusOne = resolution - 1;
		const probeSpacing = new THREE.Vector3(
			( _lightProbeContext.gridMax.x - _lightProbeContext.gridMin.x ) / resolutionMinusOne,
			( _lightProbeContext.gridMax.y - _lightProbeContext.gridMin.y ) / resolutionMinusOne,
			( _lightProbeContext.gridMax.z - _lightProbeContext.gridMin.z ) / resolutionMinusOne
		);
		const probeValidityFloor = 0.05;
		const minVariance = 0.0004;
		const currentVisibilityBiasScale = 1;
		const hitConfidenceThreshold = 0.5;
		const visibilityWeightFloor = 0.0001;
		const currentHitConfidencePolicy = {
			label: 'continuous',
			mode: 'continuous',
			threshold: hitConfidenceThreshold
		};
		const dividerX = _lightProbeContext.leakFixture !== null ? _lightProbeContext.leakFixture.thinDivider.position.x : - 0.8667;
		const dividerBox = new THREE.Box3();
		const dividerRay = new THREE.Ray();
		const dividerRayDirection = new THREE.Vector3();
		const dividerIntersectionPoint = new THREE.Vector3();
		const probeCoefficientCache = new Map();
		let probeValidity = null;
		const createZeroCoefficients = () => Array.from( { length: 9 }, () => ( { r: 0, g: 0, b: 0 } ) );
		const addScaledCoefficients = ( target, source, weight ) => {

			for ( let i = 0; i < target.length; i ++ ) {

				target[ i ].r += source[ i ].r * weight;
				target[ i ].g += source[ i ].g * weight;
				target[ i ].b += source[ i ].b * weight;

			}

		};

		const scaleCoefficients = ( coefficients, scale ) => coefficients.map( coefficient => ( {
			r: coefficient.r * scale,
			g: coefficient.g * scale,
			b: coefficient.b * scale
		} ) );
		const mixCoefficients = ( a, b, mix ) => a.map( ( coefficient, index ) => ( {
			r: coefficient.r * ( 1 - mix ) + b[ index ].r * mix,
			g: coefficient.g * ( 1 - mix ) + b[ index ].g * mix,
			b: coefficient.b * ( 1 - mix ) + b[ index ].b * mix
		} ) );
		const roundColor = color => ( {
			r: roundMetric( color.r ),
			g: roundMetric( color.g ),
			b: roundMetric( color.b )
		} );
		const createReceiverColorBias = ( color, correctSide ) => {

			const correctValue = correctSide === 'left' ? color.r : color.g;
			const wrongValue = correctSide === 'left' ? color.g : color.r;

			return {
				correctChannel: correctSide === 'left' ? 'red' : 'green',
				wrongChannel: correctSide === 'left' ? 'green' : 'red',
				correctValue: roundMetric( correctValue ),
				wrongValue: roundMetric( wrongValue ),
				correctOverWrong: roundMetric( correctValue / Math.max( wrongValue, 0.0001 ) ),
				wrongOverCorrect: roundMetric( wrongValue / Math.max( correctValue, 0.0001 ) )
			};

		};

		const createColorChromaticity = color => {

			const energy = Math.max( color.r + color.g + color.b, 0.0001 );

			return {
				r: roundMetric( color.r / energy ),
				g: roundMetric( color.g / energy ),
				b: roundMetric( color.b / energy )
			};

		};

		const createReceiverChromaPressure = ( color, correctSide ) => {

			const chromaticity = createColorChromaticity( color );
			const correctValue = correctSide === 'left' ? chromaticity.r : chromaticity.g;
			const wrongValue = correctSide === 'left' ? chromaticity.g : chromaticity.r;

			return {
				correctChromaticity: roundMetric( correctValue ),
				wrongChromaticity: roundMetric( wrongValue ),
				wrongMinusCorrect: roundMetric( wrongValue - correctValue ),
				wrongOverCorrect: roundMetric( wrongValue / Math.max( correctValue, 0.0001 ) )
			};

		};

		const evaluateProbeCoefficientsForReceiver = ( coefficients, receiverNormal ) => roundColor(
			evaluateIrradianceContract( coefficients, receiverNormal, {
				band1Intensity: _lightProbeContext.params.band1Intensity,
				band2Intensity: _lightProbeContext.params.band2Intensity,
				clampNegative: true
			} )
		);

		const readProbeCoefficients = async ( probeIndex ) => {

			if ( probeCoefficientCache.has( probeIndex ) ) return probeCoefficientCache.get( probeIndex );

			const result = await readLightProbeGridGPUProbeCoefficients(
				_lightProbeContext.renderer,
				_lightProbeContext.probeGrid,
				probeIndex,
				resolution
			);

			probeCoefficientCache.set( probeIndex, result );

			return result;

		};

		const auditDividerSegment = ( origin, target ) => {

			if ( _lightProbeContext.leakFixture === null ) {

				return {
					intersects: false,
					distance: null,
					point: null,
					reason: 'no-leak-fixture'
				};

			}

			dividerBox.setFromObject( _lightProbeContext.getActiveLeakDivider() ?? _lightProbeContext.leakFixture.thinDivider );
			dividerRayDirection.subVectors( target, origin );

			const segmentLength = dividerRayDirection.length();

			if ( segmentLength <= 0.0001 ) {

				return {
					intersects: dividerBox.containsPoint( origin ),
					distance: 0,
					point: {
						x: roundMetric( origin.x ),
						y: roundMetric( origin.y ),
						z: roundMetric( origin.z )
					},
					reason: 'zero-length-segment'
				};

			}

			if ( dividerBox.containsPoint( origin ) ) {

				return {
					intersects: true,
					distance: 0,
					point: {
						x: roundMetric( origin.x ),
						y: roundMetric( origin.y ),
						z: roundMetric( origin.z )
					},
					reason: 'origin-inside-divider'
				};

			}

			dividerRayDirection.divideScalar( segmentLength );
			dividerRay.origin.copy( origin );
			dividerRay.direction.copy( dividerRayDirection );

			const intersection = dividerRay.intersectBox( dividerBox, dividerIntersectionPoint );

			if ( intersection === null ) {

				return {
					intersects: false,
					distance: null,
					point: null,
					reason: 'misses-divider-geometry'
				};

			}

			const distance = intersection.distanceTo( origin );

			if ( distance > segmentLength + 0.0001 ) {

				return {
					intersects: false,
					distance: roundMetric( distance ),
					point: {
						x: roundMetric( intersection.x ),
						y: roundMetric( intersection.y ),
						z: roundMetric( intersection.z )
					},
					reason: 'intersection-beyond-receiver'
				};

			}

			return {
				intersects: true,
				distance: roundMetric( distance ),
				point: {
					x: roundMetric( intersection.x ),
					y: roundMetric( intersection.y ),
					z: roundMetric( intersection.z )
				},
				reason: 'segment-intersects-divider'
			};

		};

		const resolveHitConfidenceVisibility = ( hitConfidence, momentVisibility, policy ) => {

			if ( policy.mode === 'continuous' ) {

				const confidence = Math.max( 0, Math.min( hitConfidence, 1 ) );

				return confidence * momentVisibility + ( 1 - confidence );

			}

			if ( policy.mode === 'always' ) return momentVisibility;
			if ( policy.mode === 'ignore' ) return 1;

			return hitConfidence > policy.threshold ? momentVisibility : 1;

		};

		const restoreState = async () => {

			restoreProbeVisibilitySnapshot( previousVisibility );
			await restoreHarnessState( previousState, 'visibility weighting diagnostic restore' );

		};

		try {

			applyProofBakeSettings( {
				fixtureMode,
				hideBaseCornell: true,
				resolution
			} );
			await _lightProbeContext.recreateAndBakeRequired( `visibility weighting diagnostic ${ fixtureMode }` );
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			probeValidity = _lightProbeContext.createProbeValidityData( resolution );
			const probePosition = new THREE.Vector3();
			const receiverPosition = new THREE.Vector3();
			const samplePosition = new THREE.Vector3();
			const receiverNormal = new THREE.Vector3();
			const receiverQuaternion = new THREE.Quaternion();
			const receiverVector = new THREE.Vector3();
			const viewDirection = new THREE.Vector3();
			const probeDirection = new THREE.Vector3();

			const analyzeReceiver = async (
				label,
				mesh,
				correctSide,
				visibilityBiasScale = 1,
				hitConfidencePolicy = currentHitConfidencePolicy,
				surfaceSample = null,
				samplingBias = null
			) => {

				mesh.updateWorldMatrix( true, false );

				if ( surfaceSample?.worldPosition !== undefined ) {

					receiverPosition.copy( surfaceSample.worldPosition );

				} else if ( surfaceSample?.localPosition !== undefined ) {

					receiverPosition.copy( surfaceSample.localPosition ).applyMatrix4( mesh.matrixWorld );

				} else {

					mesh.getWorldPosition( receiverPosition );

				}

				mesh.getWorldQuaternion( receiverQuaternion );
				if ( surfaceSample?.worldNormal !== undefined ) {

					receiverNormal.copy( surfaceSample.worldNormal ).normalize();

				} else {

					receiverNormal.set( 0, 0, 1 ).applyQuaternion( receiverQuaternion ).normalize();

				}
				viewDirection.subVectors( _lightProbeContext.camera.position, receiverPosition ).normalize();

				const activeNormalBias = samplingBias?.normalBias ?? _lightProbeContext.params.normalBias;
				const activeViewBias = samplingBias?.viewBias ?? _lightProbeContext.params.viewBias;
				const useRuntimeVisibilityPath = surfaceSample?.visibilityPath === 'gpu-runtime-positionworld-distance-bias';
				const useRuntimeUnguardedVisibilityPath = surfaceSample?.visibilityPath === 'gpu-runtime-unguarded-visibility';
				const useRuntimeProbeMeta = surfaceSample?.probeMetaPath === 'gpu-runtime-probe-meta';
				const runtimeVisibilityDistanceBias = useRuntimeVisibilityPath ?
					_lightProbeContext.probeGrid.visibilityBias?.value ?? 0 :
					0;
				samplePosition.copy( receiverPosition ).add( new THREE.Vector3(
					receiverNormal.x * probeSpacing.x * activeNormalBias + viewDirection.x * probeSpacing.x * activeViewBias,
					receiverNormal.y * probeSpacing.y * activeNormalBias + viewDirection.y * probeSpacing.y * activeViewBias,
					receiverNormal.z * probeSpacing.z * activeNormalBias + viewDirection.z * probeSpacing.z * activeViewBias
				) );
				const visibilityReceiverPosition = receiverPosition.clone().add( new THREE.Vector3(
					receiverNormal.x * probeSpacing.x * activeNormalBias * visibilityBiasScale + viewDirection.x * probeSpacing.x * activeViewBias * visibilityBiasScale,
					receiverNormal.y * probeSpacing.y * activeNormalBias * visibilityBiasScale + viewDirection.y * probeSpacing.y * activeViewBias * visibilityBiasScale,
					receiverNormal.z * probeSpacing.z * activeNormalBias * visibilityBiasScale + viewDirection.z * probeSpacing.z * activeViewBias * visibilityBiasScale
				) );
				const runtimeVisibilityReceiverPosition = useRuntimeVisibilityPath || useRuntimeUnguardedVisibilityPath ?
					receiverPosition :
					visibilityReceiverPosition;
				const probeCoord = new THREE.Vector3(
					( samplePosition.x - _lightProbeContext.gridMin.x ) / ( _lightProbeContext.gridMax.x - _lightProbeContext.gridMin.x ),
					( samplePosition.y - _lightProbeContext.gridMin.y ) / ( _lightProbeContext.gridMax.y - _lightProbeContext.gridMin.y ),
					( samplePosition.z - _lightProbeContext.gridMin.z ) / ( _lightProbeContext.gridMax.z - _lightProbeContext.gridMin.z )
				).clampScalar( 0, 1 ).multiplyScalar( resolutionMinusOne );
				const base = new THREE.Vector3(
					Math.floor( probeCoord.x ),
					Math.floor( probeCoord.y ),
					Math.floor( probeCoord.z )
				);
				const blend = new THREE.Vector3().subVectors( probeCoord, base );
				const x0 = base.x;
				const y0 = base.y;
				const z0 = base.z;
				const x1 = Math.min( x0 + 1, resolutionMinusOne );
				const y1 = Math.min( y0 + 1, resolutionMinusOne );
				const z1 = Math.min( z0 + 1, resolutionMinusOne );
				const wx0 = 1 - blend.x;
				const wy0 = 1 - blend.y;
				const wz0 = 1 - blend.z;
				const neighbors = [
					{ coord: [ x0, y0, z0 ], trilinearWeight: wx0 * wy0 * wz0 },
					{ coord: [ x1, y0, z0 ], trilinearWeight: blend.x * wy0 * wz0 },
					{ coord: [ x0, y1, z0 ], trilinearWeight: wx0 * blend.y * wz0 },
					{ coord: [ x1, y1, z0 ], trilinearWeight: blend.x * blend.y * wz0 },
					{ coord: [ x0, y0, z1 ], trilinearWeight: wx0 * wy0 * blend.z },
					{ coord: [ x1, y0, z1 ], trilinearWeight: blend.x * wy0 * blend.z },
					{ coord: [ x0, y1, z1 ], trilinearWeight: wx0 * blend.y * blend.z },
					{ coord: [ x1, y1, z1 ], trilinearWeight: blend.x * blend.y * blend.z }
				];
				const rows = [];

				for ( const neighbor of neighbors ) {

					const [ x, y, z ] = neighbor.coord;
					const probeIndex = getLightProbeGridGPUProbeIndex( x, y, z, resolution );
					_lightProbeContext.getGridProbePosition( probeIndex, resolution, probePosition );
					probeDirection.subVectors( probePosition, receiverPosition ).normalize();
					receiverVector.subVectors( runtimeVisibilityReceiverPosition, probePosition );

					const receiverDistance = receiverVector.length();
					const receiverDirection = receiverVector.clone().normalize();
					const moment = await readLightProbeGridGPUVisibilityMoment(
						_lightProbeContext.renderer,
						_lightProbeContext.probeGrid,
						receiverDirection,
						probeIndex,
						minVariance
					);
					const delta = Math.max( receiverDistance - moment.meanDistance - runtimeVisibilityDistanceBias, 0 );
					const chebyshevVisibility = moment.variance / ( moment.variance + delta * delta );
					const momentVisibility = chebyshevVisibility;
					const visibility = useRuntimeUnguardedVisibilityPath ?
						1 :
						resolveHitConfidenceVisibility( moment.hitConfidence, momentVisibility, hitConfidencePolicy );
					const normalWeight = ( ( receiverNormal.dot( probeDirection ) + 1 ) * 0.5 ) * 0.5 + 0.5;
					const rawProbeValidity = probeValidity[ probeIndex ] ?? 1;
					const validityWeight = Math.max( rawProbeValidity, probeValidityFloor );
					const confidenceWeight = useRuntimeProbeMeta ? Math.max( 0, Math.min( rawProbeValidity, 1 ) ) : 1;
					const layerCompatibility = 1;
					const dilationOnlyWeight = neighbor.trilinearWeight * normalWeight;
					const scalarWeight = dilationOnlyWeight * validityWeight * confidenceWeight * layerCompatibility;
					const kernelOffsetX = ( receiverPosition.x - probePosition.x ) / probeSpacing.x;
					const kernelOffsetY = ( receiverPosition.y - probePosition.y ) / probeSpacing.y;
					const kernelOffsetZ = ( receiverPosition.z - probePosition.z ) / probeSpacing.z;
					const compatibleKernel = useRuntimeUnguardedVisibilityPath ? 1 : Math.pow(
						2,
						- ( kernelOffsetX * kernelOffsetX + kernelOffsetY * kernelOffsetY + kernelOffsetZ * kernelOffsetZ )
					);
					const baseWeight = scalarWeight * compatibleKernel;
					const visibilityWeight = baseWeight * visibility;
					const side = probePosition.x < dividerX ? 'left' : 'right';
					const relationToReceiver = side === correctSide ? 'correct-side' : 'wrong-side';
					const crossesDivider = ( probePosition.x - dividerX ) * ( runtimeVisibilityReceiverPosition.x - dividerX ) <= 0;
					const visibilitySegmentDividerAudit = auditDividerSegment( probePosition, runtimeVisibilityReceiverPosition );
					const surfaceSegmentDividerAudit = auditDividerSegment( probePosition, receiverPosition );
					const suppression = visibilityWeight / Math.max( baseWeight, 0.0001 );
					const escaped = relationToReceiver === 'wrong-side' && baseWeight > 0.0001 && suppression > 0.9;
					let escapeReason = 'not-escaped';

					if ( relationToReceiver === 'correct-side' ) {

						escapeReason = 'correct-side';

					} else if ( baseWeight <= 0.0001 ) {

						escapeReason = 'zero-scalar-weight';

					} else if ( escaped === false ) {

						escapeReason = 'suppressed';

					} else if ( visibilitySegmentDividerAudit.intersects === false && surfaceSegmentDividerAudit.intersects === true ) {

						escapeReason = 'visibility-bias-bypasses-divider';

					} else if ( visibilitySegmentDividerAudit.intersects === false ) {

						escapeReason = 'front-edge-bypass';

					} else if ( hitConfidencePolicy.mode === 'threshold' && moment.hitConfidence <= hitConfidencePolicy.threshold ) {

						escapeReason = 'below-hit-threshold';

					} else if ( delta <= 0 ) {

						escapeReason = 'receiver-before-mean';

					} else if ( chebyshevVisibility > 0.9 ) {

						escapeReason = 'high-chebyshev-visibility';

					} else {

						escapeReason = 'weak-crush-or-weighting';

					}

					rows.push( {
						probeIndex,
						relationToReceiver,
						crossesDivider,
						compatibleKernel: roundMetric( compatibleKernel ),
						visibility: roundMetric( visibility ),
						scalarWeight: roundMetric( scalarWeight ),
						baseWeight: roundMetric( baseWeight ),
						visibilityWeight: roundMetric( visibilityWeight ),
						escaped,
						escapeReason
					} );

				}

				const wrongSideRows = rows.filter( row => row.relationToReceiver === 'wrong-side' && row.baseWeight > 0.0001 );
				const escapedRows = wrongSideRows.filter( row => row.escaped === true );
				const escapeReasons = escapedRows.reduce( ( reasons, row ) => {

					reasons[ row.escapeReason ] = ( reasons[ row.escapeReason ] ?? 0 ) + 1;
					return reasons;

				}, {} );

				const sum = ( relation, key ) => rows
					.filter( row => row.relationToReceiver === relation )
					.reduce( ( total, row ) => total + row[ key ], 0 );
				const scalarCorrect = sum( 'correct-side', 'scalarWeight' );
				const scalarWrong = sum( 'wrong-side', 'scalarWeight' );
				const baseCorrect = sum( 'correct-side', 'baseWeight' );
				const baseWrong = sum( 'wrong-side', 'baseWeight' );
				const visibilityCorrect = sum( 'correct-side', 'visibilityWeight' );
				const visibilityWrong = sum( 'wrong-side', 'visibilityWeight' );
				const baseSum = rows.reduce( ( total, row ) => total + row.baseWeight, 0 );
				const visibleSum = rows.reduce( ( total, row ) => total + row.visibilityWeight, 0 );
				const baseContributionSum = baseCorrect + baseWrong;
				const visibleContributionSum = visibilityCorrect + visibilityWrong;

				return {
					label,
					correctSide,
					quadratureWeight: roundMetric( surfaceSample?.quadratureWeight ?? 1 ),
					receiverNormal: {
						x: roundMetric( receiverNormal.x ),
						y: roundMetric( receiverNormal.y ),
						z: roundMetric( receiverNormal.z )
					},
					rows,
					totals: {
						scalarCorrect: roundMetric( scalarCorrect ),
						scalarWrong: roundMetric( scalarWrong ),
						baseSum: roundMetric( baseSum ),
						visibleSum: roundMetric( visibleSum ),
						visibilityMass: roundMetric( visibleSum / Math.max( baseSum, 0.0001 ) ),
						baseWrongContributionRatio: roundMetric( baseWrong / Math.max( baseContributionSum, 0.0001 ) ),
						visibleWrongContributionRatio: roundMetric( visibilityWrong / Math.max( visibleContributionSum, 0.0001 ) ),
						correctSuppression: roundMetric( visibilityCorrect / Math.max( scalarCorrect, 0.0001 ) ),
						wrongSuppression: roundMetric( visibilityWrong / Math.max( scalarWrong, 0.0001 ) )
					},
					escapeSummary: {
						wrongSideProbeCount: wrongSideRows.length,
						wrongSideEscapedCount: escapedRows.length,
						crossingWrongSideEscapedCount: escapedRows.filter( row => row.crossesDivider === true ).length,
						lowHitConfidenceEscapeCount: escapedRows.filter( row => row.escapeReason === 'below-hit-threshold' ).length,
						receiverBeforeMeanEscapeCount: escapedRows.filter( row => row.escapeReason === 'receiver-before-mean' ).length,
						highChebyshevEscapeCount: escapedRows.filter( row => row.escapeReason === 'high-chebyshev-visibility' ).length,
						visibilityBypassEscapeCount: escapedRows.filter( row => row.escapeReason === 'visibility-bias-bypasses-divider' ).length,
						frontEdgeBypassEscapeCount: escapedRows.filter( row => row.escapeReason === 'front-edge-bypass' ).length,
						escapeReasons,
						escapedProbes: escapedRows.map( row => ( {
							probeIndex: row.probeIndex,
							escapeReason: row.escapeReason,
							crossesDivider: row.crossesDivider
						} ) )
					}
				};

			};

			const summarizeReceivers = ( leftReceiver, rightReceiver ) => {

				const comparableReceivers = [ leftReceiver, rightReceiver ].filter( receiver =>
					receiver.totals.scalarCorrect > 0.0001 &&
					receiver.totals.scalarWrong > 0.0001
				);
				const averageComparable = ( key ) => comparableReceivers.reduce(
					( total, receiver ) => total + receiver.totals[ key ], 0
				) / Math.max( comparableReceivers.length, 1 );
				const receiverRows = [ leftReceiver, rightReceiver ];
				const averageReceiver = ( key ) => receiverRows.reduce(
					( total, receiver ) => total + ( receiver.totals[ key ] ?? 0 ), 0
				) / Math.max( receiverRows.length, 1 );
				const correctSuppressionMean = averageComparable( 'correctSuppression' );
				const wrongSuppressionMean = averageComparable( 'wrongSuppression' );
				const wrongMinusCorrectSuppression = wrongSuppressionMean - correctSuppressionMean;
				const visibilityWrongContributionDelta = averageReceiver( 'visibleWrongContributionRatio' ) - averageReceiver( 'baseWrongContributionRatio' );

				return {
					comparableReceiverCount: comparableReceivers.length,
					baseSumMean: roundMetric( averageReceiver( 'baseSum' ) ),
					visibleSumMean: roundMetric( averageReceiver( 'visibleSum' ) ),
					visibilityMassMean: roundMetric( averageReceiver( 'visibilityMass' ) ),
					visibleWrongContributionRatioMean: roundMetric( averageReceiver( 'visibleWrongContributionRatio' ) ),
					wrongContributionRatioDelta: roundMetric( visibilityWrongContributionDelta ),
					wrongMinusCorrectSuppression: roundMetric( wrongMinusCorrectSuppression ),
					directionalSuppressionSupported: comparableReceivers.length > 0 &&
						wrongMinusCorrectSuppression <= 0
				};

			};

			const left = await analyzeReceiver( 'leftReceiver', _lightProbeContext.leakFixture.leftReceiver, 'left', currentVisibilityBiasScale );
			const right = await analyzeReceiver( 'rightReceiver', _lightProbeContext.leakFixture.rightReceiver, 'right', currentVisibilityBiasScale );
			const summary = summarizeReceivers( left, right );
			const combineEscapeSummary = ( receivers ) => {

				const escapedProbes = receivers.flatMap( receiver => receiver.escapeSummary.escapedProbes.map( probe => ( {
					receiver: receiver.label,
					probeIndex: probe.probeIndex,
					escapeReason: probe.escapeReason,
					crossesDivider: probe.crossesDivider
				} ) ) );
				const escapeReasons = escapedProbes.reduce( ( reasons, row ) => {

					reasons[ row.escapeReason ] = ( reasons[ row.escapeReason ] ?? 0 ) + 1;
					return reasons;

				}, {} );

				return {
					wrongSideProbeCount: receivers.reduce( ( total, receiver ) => total + receiver.escapeSummary.wrongSideProbeCount, 0 ),
					wrongSideEscapedCount: escapedProbes.length,
					crossingWrongSideEscapedCount: escapedProbes.filter( row => row.crossesDivider === true ).length,
					visibilityBypassEscapeCount: escapedProbes.filter( row => row.escapeReason === 'visibility-bias-bypasses-divider' ).length,
					frontEdgeBypassEscapeCount: escapedProbes.filter( row => row.escapeReason === 'front-edge-bypass' ).length,
					lowHitConfidenceEscapeCount: escapedProbes.filter( row => row.escapeReason === 'below-hit-threshold' ).length,
					receiverBeforeMeanEscapeCount: escapedProbes.filter( row => row.escapeReason === 'receiver-before-mean' ).length,
					highChebyshevEscapeCount: escapedProbes.filter( row => row.escapeReason === 'high-chebyshev-visibility' ).length,
					escapeReasons,
					escapedProbes
				};

			};

			const aggregateReceiverCoefficients = async ( rows, weightKey, predicate = () => true, coefficientReader = readProbeCoefficients ) => {

				const coefficients = createZeroCoefficients();
				let totalWeight = 0;

				for ( const row of rows ) {

					if ( predicate( row ) === false ) continue;

					const weight = row[ weightKey ];

					if ( weight <= 0 ) continue;

					const probe = await coefficientReader( row.probeIndex );
					addScaledCoefficients( coefficients, probe.coefficients, weight );
					totalWeight += weight;

				}

				return {
					totalWeight,
					coefficients: scaleCoefficients( coefficients, 1 / Math.max( totalWeight, 0.0001 ) )
				};

			};

			const createAggregateEvaluation = async ( receiver, weightKey, predicate = () => true, coefficientReader = readProbeCoefficients ) => {

				const normal = new THREE.Vector3(
					receiver.receiverNormal.x,
					receiver.receiverNormal.y,
					receiver.receiverNormal.z
				);
				const aggregate = await aggregateReceiverCoefficients( receiver.rows, weightKey, predicate, coefficientReader );
				const irradiance = evaluateProbeCoefficientsForReceiver( aggregate.coefficients, normal );

				return {
					totalWeight: roundMetric( aggregate.totalWeight ),
					coefficients: aggregate.coefficients,
					colorBias: createReceiverColorBias( irradiance, receiver.correctSide ),
					chromaPressure: createReceiverChromaPressure( irradiance, receiver.correctSide )
				};

			};

			const {
				analyzeReceiverShContributions,
				analyzeShContributionDiagnostics
			} = createLightProbeGridGPUShDiagnostics( {
				createAggregateEvaluation,
				createReceiverChromaPressure,
				createReceiverColorBias,
				evaluateProbeCoefficientsForReceiver,
				mixCoefficients,
				readProbeCoefficients,
				roundColor,
				roundMetric,
				visibilityWeightFloor
			} );
			const {
				createReceiverSurfaceQuadratureDiagnostic,
				captureReceiverGpuDebugDiagnostics
			} = createLightProbeGridGPUReceiverDiagnostics( {
				_lightProbeContext,
				analyzeReceiver,
				analyzeReceiverShContributions,
				captureLeakRegionMetrics,
				currentHitConfidencePolicy,
				currentVisibilityBiasScale,
				fixtureMode,
				roundMetric
			} );



			const escapeClassification = combineEscapeSummary( [ left, right ] );
			const shContributionDiagnostic = await analyzeShContributionDiagnostics( left, right, escapeClassification, summary );
			const receiverSurfaceQuadratureDiagnostic = await createReceiverSurfaceQuadratureDiagnostic();
			const receiverGpuDebugDiagnostic = await captureReceiverGpuDebugDiagnostics( receiverSurfaceQuadratureDiagnostic );
			const compactReceiver = receiver => ( {
				label: receiver.label,
				correctSide: receiver.correctSide,
				rows: receiver.rows.map( row => ( {
					visibility: row.visibility,
					scalarWeight: row.scalarWeight,
					baseWeight: row.baseWeight,
					compatibleKernel: row.compatibleKernel,
					visibilityWeight: row.visibilityWeight,
					crossesDivider: row.crossesDivider,
					escaped: row.escaped,
					escapeReason: row.escapeReason
				} ) )
			} );
			const dominantEscapeReason = Object.entries( escapeClassification.escapeReasons )
				.sort( ( a, b ) => b[ 1 ] - a[ 1 ] )
				.at( 0 ) ?? [ 'none', 0 ];
			const interrogationFinding = escapeClassification.frontEdgeBypassEscapeCount > 0 ?
				'GEOMETRY-FRONT-EDGE-BYPASS' :
				escapeClassification.visibilityBypassEscapeCount > 0 ?
					'VISIBILITY-BIAS-BYPASS' :
					escapeClassification.lowHitConfidenceEscapeCount > 0 ?
						'HIT-CONFIDENCE-THRESHOLD-BYPASS' :
						summary.wrongMinusCorrectSuppression > 0 ?
							'WEIGHTING-SUPPRESSES-CORRECT-MORE-THAN-WRONG' :
							'CPU-DIRECTIONAL-SUPPRESSION-SUPPORTED';
			return {
				status: summary.directionalSuppressionSupported ? 'SUPPORTED-DIRECTIONAL-SUPPRESSION' : 'OPEN-CORRECT-SIDE-SUPPRESSED',
				fixtureMode,
				proofBoundary: fixtureMode === 'thin-wall' ?
					'CPU mirror of current shader weighting for thin-wall receiver centers; diagnostic only, not a public API.' :
					'CPU mirror of current shader weighting for sealed-wall receiver centers; diagnostic only, not a public API.',
				visibilityDepth: typeof _lightProbeContext.probeGrid.getVisibilityDepthInfo === 'function' ? _lightProbeContext.probeGrid.getVisibilityDepthInfo() : { available: false, mode: 'unavailable-proof-6-runtime-removed', resolution: 0, bytes: 0 },
				left: compactReceiver( left ),
				right: compactReceiver( right ),
				summary,
				escapeClassification,
				shContributionDiagnostic,
				receiverSurfaceQuadratureDiagnostic,
				receiverGpuDebugDiagnostic,
				interrogationFinding,
				dominantEscapeReason: {
					reason: dominantEscapeReason[ 0 ],
					count: dominantEscapeReason[ 1 ]
				}
			};

		} finally {

			await restoreState();

		}

	};

	return inspectVisibilityWeightingAtLeakReceivers;

}
