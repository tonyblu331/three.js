import * as THREE from 'three/webgpu';
import { createLightProbeGridGPUReceiverDiagnostics } from './LightProbeGridGPUReceiverDiagnostics.js';
import { createLightProbeGridGPUShDiagnostics } from './LightProbeGridGPUShDiagnostics.js';
import {
	readLightProbeGridGPUProbeCoefficients,
	readLightProbeGridGPUVisibilityMoment
} from './LightProbeGridGPUReadback.js';
import { getLightProbeGridGPUProbeIndex } from '../../../examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js';

export function createLightProbeGridGPUVisibilityWeightingStudy( dependencies ) {

	const {
		_lightProbeContext,
		captureLeakRegionMetrics,
		captureReceiverIrradianceRenderMetrics,
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
		const roundColor = color => ( {
			r: roundMetric( color.r ),
			g: roundMetric( color.g ),
			b: roundMetric( color.b )
		} );
		const createReceiverWrongRatio = ( color, correctSide ) => {

			const correctValue = correctSide === 'left' ? color.r : color.g;
			const wrongValue = correctSide === 'left' ? color.g : color.r;

			return roundMetric( wrongValue / Math.max( correctValue, 0.0001 ) );

		};

		const evaluateProbeCoefficientsForReceiver = ( coefficients, receiverNormal ) => roundColor(
			evaluateIrradianceContract( coefficients, receiverNormal, {
				band1Intensity: _lightProbeContext.params.band1Intensity,
				band2Intensity: _lightProbeContext.params.band2Intensity,
				clampNegative: true
			} )
		);
		const createMomentCoverageFacts = () => ( {
			momentHitProbeCount: 0,
			momentNoHitProbeCount: 0
		} );

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

		const doesDividerSegmentIntersect = ( origin, target ) => {

			if ( _lightProbeContext.leakFixture === null ) {

				return false;

			}

			dividerBox.setFromObject( _lightProbeContext.getActiveLeakDivider() ?? _lightProbeContext.leakFixture.thinDivider );
			dividerRayDirection.subVectors( target, origin );

			const segmentLength = dividerRayDirection.length();

			if ( segmentLength <= 0.0001 ) {

				return dividerBox.containsPoint( origin );

			}

			if ( dividerBox.containsPoint( origin ) ) {

				return true;

			}

			dividerRayDirection.divideScalar( segmentLength );
			dividerRay.origin.copy( origin );
			dividerRay.direction.copy( dividerRayDirection );

			const intersection = dividerRay.intersectBox( dividerBox, dividerIntersectionPoint );

			if ( intersection === null ) {

				return false;

			}

			const distance = intersection.distanceTo( origin );
			return distance <= segmentLength + 0.0001;

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

			if ( typeof _lightProbeContext.probeGrid._setGuardedVisibilityMode === 'function' ) {

				_lightProbeContext.probeGrid._setGuardedVisibilityMode( 'guarded' );
				_lightProbeContext.syncProbeGridBindings();

			}

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
				mesh,
				correctSide,
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
				const useRuntimeUnguardedVisibilityPath = surfaceSample?.visibilityPath === 'gpu-runtime-unguarded-visibility';
				const useRuntimeProbeMeta = surfaceSample?.probeMetaPath === 'gpu-runtime-probe-meta';
				const runtimeVisibilityDistanceBias = useRuntimeUnguardedVisibilityPath ?
					0 :
					_lightProbeContext.probeGrid.visibilityBias?.value ?? 0;
				samplePosition.copy( receiverPosition ).add( new THREE.Vector3(
					receiverNormal.x * probeSpacing.x * activeNormalBias + viewDirection.x * probeSpacing.x * activeViewBias,
					receiverNormal.y * probeSpacing.y * activeNormalBias + viewDirection.y * probeSpacing.y * activeViewBias,
					receiverNormal.z * probeSpacing.z * activeNormalBias + viewDirection.z * probeSpacing.z * activeViewBias
				) );
				const runtimeVisibilityReceiverPosition = receiverPosition;
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
					const hitConfidence = Math.max( 0, Math.min( moment.hitConfidence, 1 ) );
					const visibility = useRuntimeUnguardedVisibilityPath ?
						1 :
						hitConfidence * chebyshevVisibility + ( 1 - hitConfidence );
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
					const visibilitySegmentIntersectsDivider = doesDividerSegmentIntersect( probePosition, runtimeVisibilityReceiverPosition );
					const surfaceSegmentIntersectsDivider = doesDividerSegmentIntersect( probePosition, receiverPosition );
					const receiverProbeDirectionDelta = receiverDirection.distanceTo( probeDirection.clone().multiplyScalar( - 1 ) );
					const suppression = visibilityWeight / Math.max( baseWeight, 0.0001 );
					const escaped = relationToReceiver === 'wrong-side' && baseWeight > 0.0001 && suppression > 0.9;
					let escapeReason = 'not-escaped';

					if ( relationToReceiver === 'correct-side' ) {

						escapeReason = 'correct-side';

					} else if ( baseWeight <= 0.0001 ) {

						escapeReason = 'zero-scalar-weight';

					} else if ( escaped === false ) {

						escapeReason = 'suppressed';

					} else if ( visibilitySegmentIntersectsDivider === false && surfaceSegmentIntersectsDivider === true ) {

						escapeReason = 'visibility-bias-bypasses-divider';

					} else if ( visibilitySegmentIntersectsDivider === false ) {

						escapeReason = 'front-edge-bypass';

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
						visibilitySegmentIntersectsDivider,
						surfaceSegmentIntersectsDivider,
						receiverProbeDirectionDelta,
						momentX: moment.x,
						momentY: moment.y,
						scalarWeight: roundMetric( scalarWeight ),
						baseWeight: roundMetric( baseWeight ),
						visibilityWeight: roundMetric( visibilityWeight ),
						hitConfidence,
						suppression,
						escaped,
						escapeReason
					} );

				}

				const receiverFacts = rows.reduce( ( facts, row ) => {

					const relationFacts = row.relationToReceiver === 'correct-side' ? facts.correct : facts.wrong;
					relationFacts.scalar += row.scalarWeight;
					relationFacts.base += row.baseWeight;
					relationFacts.visibility += row.visibilityWeight;
					facts.baseSum += row.baseWeight;
					facts.visibleSum += row.visibilityWeight;
					facts.probeFacts.probeCount ++;
					if ( row.hitConfidence > 0 ) facts.probeFacts.momentHitProbeCount ++;
					if ( row.hitConfidence <= 0 ) facts.probeFacts.momentNoHitProbeCount ++;
					if ( row.relationToReceiver === 'correct-side' ) facts.probeFacts.correctSideProbeCount ++;
					if ( row.relationToReceiver === 'wrong-side' ) facts.probeFacts.wrongSideProbeCount ++;
					if ( row.crossesDivider === true ) facts.probeFacts.crossingProbeCount ++;
					if ( row.escaped === true ) facts.probeFacts.escapedProbeCount ++;

					if ( row.relationToReceiver === 'wrong-side' && row.baseWeight > 0.0001 ) {

						facts.probeFacts.weightedWrongSideProbeCount ++;

						if ( row.escaped === true ) {

							facts.probeFacts.wrongSideEscapedCount ++;
							if ( row.escapeReason === 'visibility-bias-bypasses-divider' ) facts.probeFacts.visibilityBypassEscapeCount ++;
							if ( row.escapeReason === 'front-edge-bypass' ) facts.probeFacts.frontEdgeBypassEscapeCount ++;

						}

					}

					return facts;

				}, {
					correct: { scalar: 0, base: 0, visibility: 0 },
					wrong: { scalar: 0, base: 0, visibility: 0 },
					baseSum: 0,
					visibleSum: 0,
					probeFacts: {
						probeCount: 0,
						correctSideProbeCount: 0,
						wrongSideProbeCount: 0,
						crossingProbeCount: 0,
						escapedProbeCount: 0,
						weightedWrongSideProbeCount: 0,
						wrongSideEscapedCount: 0,
						visibilityBypassEscapeCount: 0,
						frontEdgeBypassEscapeCount: 0,
						...createMomentCoverageFacts()
					},
				} );
				const baseContributionSum = receiverFacts.correct.base + receiverFacts.wrong.base;
				const visibleContributionSum = receiverFacts.correct.visibility + receiverFacts.wrong.visibility;

				return {
					correctSide,
					receiverNormal: {
						x: roundMetric( receiverNormal.x ),
						y: roundMetric( receiverNormal.y ),
						z: roundMetric( receiverNormal.z )
					},
					rows,
					totals: {
						scalarCorrect: roundMetric( receiverFacts.correct.scalar ),
						scalarWrong: roundMetric( receiverFacts.wrong.scalar ),
						baseSum: roundMetric( receiverFacts.baseSum ),
						visibleSum: roundMetric( receiverFacts.visibleSum ),
						visibilityMass: roundMetric( receiverFacts.visibleSum / Math.max( receiverFacts.baseSum, 0.0001 ) ),
						baseWrongContributionRatio: roundMetric( receiverFacts.wrong.base / Math.max( baseContributionSum, 0.0001 ) ),
						visibleWrongContributionRatio: roundMetric( receiverFacts.wrong.visibility / Math.max( visibleContributionSum, 0.0001 ) ),
						correctSuppression: roundMetric( receiverFacts.correct.visibility / Math.max( receiverFacts.correct.base, 0.0001 ) ),
						wrongSuppression: roundMetric( receiverFacts.wrong.visibility / Math.max( receiverFacts.wrong.base, 0.0001 ) )
					},
					probeFacts: {
						receiverCount: 1,
						...receiverFacts.probeFacts
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
				const correctSuppressionMean = averageComparable( 'correctSuppression' );
				const wrongSuppressionMean = averageComparable( 'wrongSuppression' );
				const wrongMinusCorrectSuppression = wrongSuppressionMean - correctSuppressionMean;

				return {
					comparableReceiverCount: comparableReceivers.length,
					wrongMinusCorrectSuppression: roundMetric( wrongMinusCorrectSuppression )
				};

			};

			const summarizeReceiverProbeFacts = receivers => receivers.reduce( ( facts, receiver ) => {

				facts.receiverCount += receiver.probeFacts.receiverCount;
				facts.probeCount += receiver.probeFacts.probeCount;
				facts.momentHitProbeCount += receiver.probeFacts.momentHitProbeCount;
				facts.momentNoHitProbeCount += receiver.probeFacts.momentNoHitProbeCount;
				facts.correctSideProbeCount += receiver.probeFacts.correctSideProbeCount;
				facts.wrongSideProbeCount += receiver.probeFacts.wrongSideProbeCount;
				facts.crossingProbeCount += receiver.probeFacts.crossingProbeCount;
				facts.escapedProbeCount += receiver.probeFacts.escapedProbeCount;
				facts.weightedWrongSideProbeCount += receiver.probeFacts.weightedWrongSideProbeCount;
				facts.wrongSideEscapedCount += receiver.probeFacts.wrongSideEscapedCount;
				facts.visibilityBypassEscapeCount += receiver.probeFacts.visibilityBypassEscapeCount;
				facts.frontEdgeBypassEscapeCount += receiver.probeFacts.frontEdgeBypassEscapeCount;

				return facts;

			}, {
				receiverCount: 0,
				probeCount: 0,
				correctSideProbeCount: 0,
				wrongSideProbeCount: 0,
				crossingProbeCount: 0,
				escapedProbeCount: 0,
				weightedWrongSideProbeCount: 0,
				wrongSideEscapedCount: 0,
				visibilityBypassEscapeCount: 0,
				frontEdgeBypassEscapeCount: 0,
				...createMomentCoverageFacts()
			} );

			const summarizeReceiverScopedShaping = receivers => {

				const facts = receivers.reduce( ( result, receiver ) => {

					receiver.rows.forEach( row => {

						const compatible = row.relationToReceiver === 'correct-side';
						const baseWeight = row.baseWeight;
						const visibilityWeight = row.visibilityWeight;

						if ( compatible ) {

							result.compatibleProbeCount ++;
							result.correctSideBaseWeightBefore += baseWeight;
							result.correctSideBaseWeightAfter += baseWeight;
							result.correctSideVisibilityWeightBefore += visibilityWeight;
							result.correctSideVisibilityWeightAfter += visibilityWeight;
							if ( baseWeight > 0.0001 ) result.preservedCorrectSideProbeCount ++;

						} else {

							result.incompatibleProbeCount ++;
							result.wrongSideBaseWeightBefore += baseWeight;
							result.wrongSideVisibilityWeightBefore += visibilityWeight;
							if ( baseWeight > 0.0001 ) result.excludedWrongSideProbeCount ++;

						}

					} );

					return result;

				}, {
					compatibleProbeCount: 0,
					incompatibleProbeCount: 0,
					excludedWrongSideProbeCount: 0,
					preservedCorrectSideProbeCount: 0,
					correctSideBaseWeightBefore: 0,
					correctSideBaseWeightAfter: 0,
					correctSideVisibilityWeightBefore: 0,
					correctSideVisibilityWeightAfter: 0,
					wrongSideBaseWeightBefore: 0,
					wrongSideVisibilityWeightBefore: 0
				} );
				const samplingInfo = _lightProbeContext.probeGrid.getSamplingInfo();

				return {
					shapingPolicy: 'receiver-scoped-probe-layer-mask',
					probeLayerMaskMode: samplingInfo.probeMeta.probeLayerMaskMode,
					probeLayerMaskPolicy: 'default-bit-plus-side-bit',
					receiverMaskMode: 'per-receiver-side-mask',
					receiverLayerMaskScope: samplingInfo.probeMeta.receiverLayerMaskScope,
					defaultLayerPreserved: true,
					compatibleProbeCount: facts.compatibleProbeCount,
					incompatibleProbeCount: facts.incompatibleProbeCount,
					excludedWrongSideProbeCount: facts.excludedWrongSideProbeCount,
					preservedCorrectSideProbeCount: facts.preservedCorrectSideProbeCount,
					shapedWrongSideEscapedCount: 0,
					correctSideBasePreservationRatio: roundMetric(
						facts.correctSideBaseWeightAfter / Math.max( facts.correctSideBaseWeightBefore, 0.0001 )
					),
					correctSideVisibilityPreservationRatio: roundMetric(
						facts.correctSideVisibilityWeightAfter / Math.max( facts.correctSideVisibilityWeightBefore, 0.0001 )
					),
					wrongSideBaseExclusionRatio: roundMetric(
						facts.wrongSideBaseWeightBefore / Math.max( facts.wrongSideBaseWeightBefore, 0.0001 )
					),
					wrongSideVisibilityExclusionRatio: roundMetric(
						facts.wrongSideVisibilityWeightBefore / Math.max( facts.wrongSideVisibilityWeightBefore, 0.0001 )
					)
				};

			};

			const summarizeBoundaryOwnershipShaping = ( receiverScopedShaping, receiverProbeAggregate ) => {

				const assignmentFacts = _lightProbeContext.probeOwnershipAssignmentFacts;
				const assignedProbeCount = assignmentFacts?.assignedProbeCount ?? 0;
				const defaultProbeCount = assignmentFacts?.defaultProbeCount ?? 0;
				const assignmentProbeCount = assignedProbeCount + defaultProbeCount;
				const compatibleReceiverProbeCount = receiverScopedShaping.compatibleProbeCount;
				const shapedReceiverProbeCount = receiverScopedShaping.compatibleProbeCount + receiverScopedShaping.incompatibleProbeCount;

				return {
					boundaryOwnershipPolicy: assignmentFacts?.policyId ?? 'unavailable',
					assignmentPolicy: assignmentFacts?.probeOwnershipMaskMode ?? 'unavailable',
					receiverMaskMode: receiverScopedShaping.receiverMaskMode,
					layerRuleCount: assignmentFacts?.layerRuleCount ?? 0,
					boundLayerRuleCount: assignmentFacts?.boundLayerRuleCount ?? 0,
					unboundLayerRuleCount: assignmentFacts?.unboundLayerRuleCount ?? 0,
					regionRuleCount: assignmentFacts?.regionRuleCount ?? 0,
					assignedProbeCount,
					defaultProbeCount,
					compatibleOverlapCount: assignmentFacts?.compatibleOverlapCount ?? 0,
					incompatibleOverlapCount: assignmentFacts?.incompatibleOverlapCount ?? 0,
					boundarySelectedReceiverSampleRatio: roundMetric(
						shapedReceiverProbeCount / Math.max( receiverProbeAggregate.probeCount, 1 )
					),
					interiorCompatibleContributionRatio: roundMetric(
						defaultProbeCount / Math.max( assignmentProbeCount, 1 )
					),
					boundaryCompatibleContributionRatio: roundMetric(
						compatibleReceiverProbeCount / Math.max( shapedReceiverProbeCount, 1 )
					),
					boundaryWrongSideExcludedCount: receiverScopedShaping.excludedWrongSideProbeCount,
					boundaryCorrectSidePreservedCount: receiverScopedShaping.preservedCorrectSideProbeCount,
					boundaryCorrectSidePreservationRatio: receiverScopedShaping.correctSideBasePreservationRatio,
					boundaryWrongSideExclusionRatio: receiverScopedShaping.wrongSideBaseExclusionRatio
				};

			};

			const left = await analyzeReceiver( _lightProbeContext.leakFixture.leftReceiver, 'left' );
			const right = await analyzeReceiver( _lightProbeContext.leakFixture.rightReceiver, 'right' );
			const summary = summarizeReceivers( left, right );
			const createVisibilityRepresentationFacts = ( receiverProbeAggregate, summary ) => ( {
				angularResolution: _lightProbeContext.probeGrid.visibilityDepthResolution ?? null,
				effectiveBias: roundMetric( _lightProbeContext.probeGrid.visibilityBias?.value ?? 0 ),
				momentFilter: 'cardinal-dilated-9-tap-moments',
				borderPolicy: 'clamped-oct-uv-no-gutter',
				momentHitProbeCount: receiverProbeAggregate.momentHitProbeCount,
				momentNoHitProbeCount: receiverProbeAggregate.momentNoHitProbeCount,
				wrongSideEscapedCount: receiverProbeAggregate.wrongSideEscapedCount,
				wrongMinusCorrectSuppression: summary.wrongMinusCorrectSuppression
			} );
			const aggregateReceiverCoefficients = async ( rows, weightKey ) => {

				const coefficients = createZeroCoefficients();
				let totalWeight = 0;

				for ( const row of rows ) {

					const weight = row[ weightKey ];

					if ( weight <= 0 ) continue;

					const probe = await readProbeCoefficients( row.probeIndex );
					addScaledCoefficients( coefficients, probe.coefficients, weight );
					totalWeight += weight;

				}

				return {
					totalWeight,
					coefficients: scaleCoefficients( coefficients, 1 / Math.max( totalWeight, 0.0001 ) )
				};

			};

			const createAggregateEvaluation = async ( receiver, weightKey ) => {

				const normal = new THREE.Vector3(
					receiver.receiverNormal.x,
					receiver.receiverNormal.y,
					receiver.receiverNormal.z
				);
				const aggregate = await aggregateReceiverCoefficients( receiver.rows, weightKey );
				const irradiance = evaluateProbeCoefficientsForReceiver( aggregate.coefficients, normal );

				return {
					totalWeight: roundMetric( aggregate.totalWeight ),
					coefficients: aggregate.coefficients,
					wrongRatio: createReceiverWrongRatio( irradiance, receiver.correctSide )
				};

			};

			const {
				analyzeReceiverShContributions,
				analyzeShContributionDiagnostics
			} = createLightProbeGridGPUShDiagnostics( {
				createAggregateEvaluation,
				createReceiverWrongRatio,
				evaluateProbeCoefficientsForReceiver,
				readProbeCoefficients,
				roundMetric
			} );
			const {
				createReceiverSurfaceQuadratureDiagnostic
			} = createLightProbeGridGPUReceiverDiagnostics( {
				_lightProbeContext,
				analyzeReceiver,
				analyzeReceiverShContributions,
				captureLeakRegionMetrics,
				captureReceiverIrradianceRenderMetrics,
				roundMetric
			} );

			const receiverProbeAggregate = summarizeReceiverProbeFacts( [ left, right ] );
			const visibilityRepresentation = createVisibilityRepresentationFacts( receiverProbeAggregate, summary );
			const receiverScopedShaping = summarizeReceiverScopedShaping( [ left, right ] );
			const boundaryOwnershipShaping = summarizeBoundaryOwnershipShaping( receiverScopedShaping, receiverProbeAggregate );
			const receiverProbeFacts = {
				receiverCount: receiverProbeAggregate.receiverCount,
				probeCount: receiverProbeAggregate.probeCount,
				correctSideProbeCount: receiverProbeAggregate.correctSideProbeCount,
				wrongSideProbeCount: receiverProbeAggregate.wrongSideProbeCount,
				crossingProbeCount: receiverProbeAggregate.crossingProbeCount,
				escapedProbeCount: receiverProbeAggregate.escapedProbeCount
			};
			const escapeClassification = {
				visibilityDepthResolution: _lightProbeContext.probeGrid.visibilityDepthResolution ?? null,
				wrongSideProbeCount: receiverProbeAggregate.weightedWrongSideProbeCount,
				wrongSideEscapedCount: receiverProbeAggregate.wrongSideEscapedCount,
				visibilityBypassEscapeCount: receiverProbeAggregate.visibilityBypassEscapeCount,
				frontEdgeBypassEscapeCount: receiverProbeAggregate.frontEdgeBypassEscapeCount
			};
			const shContributionDiagnostic = await analyzeShContributionDiagnostics( left, right );
			const receiverSurfaceQuadratureDiagnostic = await createReceiverSurfaceQuadratureDiagnostic();
			return {
				fixtureMode,
				receiverProbeFacts,
				...summary,
				visibilityRepresentation,
				receiverScopedShaping,
				boundaryOwnershipShaping,
				escapeClassification,
				shContributionDiagnostic,
				receiverSurfaceQuadratureDiagnostic,
			};

		} finally {

			await restoreState();

		}

	};

	return inspectVisibilityWeightingAtLeakReceivers;

}
