import * as THREE from 'three/webgpu';
import { createLightProbeGridGPUOracleDiagnostics } from './LightProbeGridGPUOracleDiagnostics.js';
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
		captureCanvasSample,
		captureLeakRegionMetrics,
		createHarnessStateSnapshot,
		createProbeVisibilitySnapshot,
		evaluateIrradianceContract,
		restoreHarnessState,
		restoreProbeVisibilitySnapshot,
		roundMetric,
		roundVector,
		setBaseCornellProbeMeshesVisible,
		setLeakFixtureMode
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
		let probeSourceMap = null;
		const diagnosticState = {
			get probeValidity() {

				return probeValidity;

			},
			get probeSourceMap() {

				return probeSourceMap;

			}
		};
		const readSourceMappedProbeCoefficients = async ( probeIndex, dilationSources = probeSourceMap ) => {

			const sourceIndex = dilationSources[ probeIndex ] ?? probeIndex;
			const source = await readProbeCoefficients( sourceIndex );

			return {
				...source,
				probeIndex,
				sourceProbeIndex: sourceIndex,
				dilated: sourceIndex !== probeIndex
			};

		};

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
		const subtractColor = ( a, b ) => ( {
			r: a.r - b.r,
			g: a.g - b.g,
			b: a.b - b.b
		} );
		const positiveColor = color => ( {
			r: Math.max( color.r, 0 ),
			g: Math.max( color.g, 0 ),
			b: Math.max( color.b, 0 )
		} );
		const measureNegativeEnergy = color => roundMetric(
			Math.max( - color.r, 0 ) +
			Math.max( - color.g, 0 ) +
			Math.max( - color.b, 0 )
		);
		const createShBandEntry = ( label, color, correctSide ) => {

			const rounded = roundColor( color );
			const positive = roundColor( positiveColor( color ) );

			return {
				label,
				irradiance: rounded,
				positiveIrradiance: positive,
				energy: roundMetric( rounded.r + rounded.g + rounded.b ),
				positiveEnergy: roundMetric( positive.r + positive.g + positive.b ),
				negativeEnergy: measureNegativeEnergy( color ),
				chromaticity: createColorChromaticity( positive ),
				chromaPressure: createReceiverChromaPressure( positive, correctSide ),
				colorBias: createReceiverColorBias( positive, correctSide )
			};

		};

		const createShBandDecomposition = ( coefficients, receiverNormal, correctSide ) => {

			const l0 = evaluateIrradianceContract( coefficients, receiverNormal, {
				band1Intensity: 0,
				band2Intensity: 0,
				clampNegative: false
			} );
			const l0L1 = evaluateIrradianceContract( coefficients, receiverNormal, {
				band1Intensity: _lightProbeContext.params.band1Intensity,
				band2Intensity: 0,
				clampNegative: false
			} );
			const fullUnclamped = evaluateIrradianceContract( coefficients, receiverNormal, {
				band1Intensity: _lightProbeContext.params.band1Intensity,
				band2Intensity: _lightProbeContext.params.band2Intensity,
				clampNegative: false
			} );
			const fullClamped = evaluateIrradianceContract( coefficients, receiverNormal, {
				band1Intensity: _lightProbeContext.params.band1Intensity,
				band2Intensity: _lightProbeContext.params.band2Intensity,
				clampNegative: true
			} );
			const l1Increment = subtractColor( l0L1, l0 );
			const l2Increment = subtractColor( fullUnclamped, l0L1 );
			const l0Entry = createShBandEntry( 'l0', l0, correctSide );
			const l1Entry = createShBandEntry( 'l1-increment', l1Increment, correctSide );
			const l2Entry = createShBandEntry( 'l2-increment', l2Increment, correctSide );
			const l0L1Entry = createShBandEntry( 'l0-l1-cumulative', l0L1, correctSide );
			const fullUnclampedEntry = createShBandEntry( 'full-unclamped', fullUnclamped, correctSide );
			const fullClampedEntry = createShBandEntry( 'full-clamped', fullClamped, correctSide );
			const l0Pressure = Math.max( l0Entry.chromaPressure.wrongMinusCorrect, 0 );
			const l0L1Pressure = Math.max( l0L1Entry.chromaPressure.wrongMinusCorrect, 0 );
			const fullPressure = Math.max( fullClampedEntry.chromaPressure.wrongMinusCorrect, 0 );
			const l1Delta = roundMetric( Math.max( l0L1Pressure - l0Pressure, 0 ) );
			const l2Delta = roundMetric( Math.max( fullPressure - l0L1Pressure, 0 ) );
			const dominantBand = [
				{ band: 'l0', pressure: roundMetric( l0Pressure ) },
				{ band: 'l1', pressure: l1Delta },
				{ band: 'l2', pressure: l2Delta }
			].sort( ( a, b ) => b.pressure - a.pressure )[ 0 ];

			return {
				l0: l0Entry,
				l1Increment: l1Entry,
				l2Increment: l2Entry,
				l0L1: l0L1Entry,
				fullUnclamped: fullUnclampedEntry,
				fullClamped: fullClampedEntry,
				pressure: {
					l0: roundMetric( l0Pressure ),
					l0L1: roundMetric( l0L1Pressure ),
					full: roundMetric( fullPressure ),
					l1Delta,
					l2Delta,
					dominantBand: dominantBand.band,
					dominantBandPressure: dominantBand.pressure
				}
			};

		};

		const shCoefficientTerms = [
			{ index: 0, band: 'l0', name: 'L00', basis: 'constant' },
			{ index: 1, band: 'l1', name: 'L1-1', basis: 'y' },
			{ index: 2, band: 'l1', name: 'L10', basis: 'z' },
			{ index: 3, band: 'l1', name: 'L11', basis: 'x' },
			{ index: 4, band: 'l2', name: 'L2-2', basis: 'xy' },
			{ index: 5, band: 'l2', name: 'L2-1', basis: 'yz' },
			{ index: 6, band: 'l2', name: 'L20', basis: '3z2-1' },
			{ index: 7, band: 'l2', name: 'L21', basis: 'xz' },
			{ index: 8, band: 'l2', name: 'L22', basis: 'x2-y2' }
		];
		const getShIrradianceBasisScales = normal => {

			const x = normal.x;
			const y = normal.y;
			const z = normal.z;

			return [
				0.886227,
				2.0 * 0.511664 * y * _lightProbeContext.params.band1Intensity,
				2.0 * 0.511664 * z * _lightProbeContext.params.band1Intensity,
				2.0 * 0.511664 * x * _lightProbeContext.params.band1Intensity,
				2.0 * 0.429043 * x * y * _lightProbeContext.params.band2Intensity,
				2.0 * 0.429043 * y * z * _lightProbeContext.params.band2Intensity,
				( 0.743125 * z * z - 0.247708 ) * _lightProbeContext.params.band2Intensity,
				2.0 * 0.429043 * x * z * _lightProbeContext.params.band2Intensity,
				0.429043 * ( x * x - y * y ) * _lightProbeContext.params.band2Intensity
			];

		};

		const getColorChannel = ( color, side ) => side === 'left' ? color.r : color.g;
		const getWrongColorChannel = ( color, side ) => side === 'left' ? color.g : color.r;
		const createShCoefficientContributionStudy = ( coefficients, normal, correctSide ) => {

			const basisScales = getShIrradianceBasisScales( normal );
			const rows = shCoefficientTerms.map( term => {

				const coefficient = coefficients[ term.index ];
				const scale = basisScales[ term.index ];
				const contribution = {
					r: coefficient.r * scale,
					g: coefficient.g * scale,
					b: coefficient.b * scale
				};
				const correctContribution = getColorChannel( contribution, correctSide );
				const wrongContribution = getWrongColorChannel( contribution, correctSide );

				return {
					coefficientIndex: term.index,
					name: term.name,
					band: term.band,
					basis: term.basis,
					basisScale: roundMetric( scale ),
					rawCoefficient: roundColor( coefficient ),
					contribution: roundColor( contribution ),
					correctContribution: roundMetric( correctContribution ),
					wrongContribution: roundMetric( wrongContribution ),
					wrongMinusCorrect: roundMetric( wrongContribution - correctContribution ),
					absoluteWrongMinusCorrect: roundMetric( Math.abs( wrongContribution - correctContribution ) ),
					negativeEnergy: measureNegativeEnergy( contribution )
				};

			} );
			const bands = [ 'l0', 'l1', 'l2' ].map( band => {

				const contribution = rows
					.filter( row => row.band === band )
					.reduce( ( total, row ) => ( {
						r: total.r + row.contribution.r,
						g: total.g + row.contribution.g,
						b: total.b + row.contribution.b
					} ), { r: 0, g: 0, b: 0 } );
				const correctContribution = getColorChannel( contribution, correctSide );
				const wrongContribution = getWrongColorChannel( contribution, correctSide );

				return {
					band,
					contribution: roundColor( contribution ),
					correctContribution: roundMetric( correctContribution ),
					wrongContribution: roundMetric( wrongContribution ),
					wrongMinusCorrect: roundMetric( wrongContribution - correctContribution ),
					negativeEnergy: measureNegativeEnergy( contribution )
				};

			} );
			const sortedRows = [ ...rows ].sort( ( a, b ) =>
				b.wrongMinusCorrect - a.wrongMinusCorrect
			);

			return {
				rows: sortedRows,
				bands: bands.sort( ( a, b ) => b.wrongMinusCorrect - a.wrongMinusCorrect ),
				dominantCoefficient: sortedRows[ 0 ] ?? null
			};

		};

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

			setBaseCornellProbeMeshesVisible( false );
			setLeakFixtureMode( fixtureMode );

			_lightProbeContext.params.resolution = resolution;
			_lightProbeContext.params.cubemapSize = 8;
			_lightProbeContext.params.projectionPrecision = 'half float';
			_lightProbeContext.params.band1Intensity = 1;
			_lightProbeContext.params.band2Intensity = 0.55;
			_lightProbeContext.params.normalBias = 0.5;
			_lightProbeContext.params.viewBias = 0;
			_lightProbeContext.params.leakReductionMode = 'normal';
			_lightProbeContext.params.useProbeValidity = true;
			_lightProbeContext.params.lightingMode = 'probes only';
			_lightProbeContext.params.probeHelper = false;
			_lightProbeContext.probeHelper.visible = false;

			if ( _lightProbeContext.params.materialType !== 'standard' ) {

				_lightProbeContext.params.materialType = 'standard';
				_lightProbeContext.updateMaterialType();

			}

			setLeakFixtureMode( fixtureMode );
			await _lightProbeContext.recreateAndBakeRequired( `visibility weighting diagnostic ${ fixtureMode }` );
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			probeValidity = _lightProbeContext.createProbeValidityData( resolution );
			probeSourceMap = _lightProbeContext.createProbeSourceMapData( resolution, probeValidity );
			const probePosition = new THREE.Vector3();
			const receiverPosition = new THREE.Vector3();
			const receiverLocalPosition = new THREE.Vector3();
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

				receiverLocalPosition.copy( receiverPosition );
				mesh.worldToLocal( receiverLocalPosition );
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
						coord: { x, y, z },
						side,
						relationToReceiver,
						probePosition: {
							x: roundMetric( probePosition.x ),
							y: roundMetric( probePosition.y ),
							z: roundMetric( probePosition.z )
						},
						octaTexel: {
							x: moment.x,
							y: moment.y
						},
						crossesDivider,
						visibilitySegmentDividerAudit,
						surfaceSegmentDividerAudit,
						trilinearWeight: roundMetric( neighbor.trilinearWeight ),
						normalWeight: roundMetric( normalWeight ),
						validityWeight: roundMetric( validityWeight ),
						confidenceWeight: roundMetric( confidenceWeight ),
						layerCompatibility: roundMetric( layerCompatibility ),
						compatibleKernel: roundMetric( compatibleKernel ),
						dilationOnlyWeight: roundMetric( dilationOnlyWeight ),
						receiverDistance: roundMetric( receiverDistance ),
						meanDistance: roundMetric( moment.meanDistance ),
						delta: roundMetric( delta ),
						variance: roundMetric( moment.variance ),
						hitConfidence: roundMetric( moment.hitConfidence ),
						backfaceConfidence: roundMetric( moment.backfaceConfidence ),
						momentEncoding: moment.momentEncoding,
						chebyshevVisibility: roundMetric( chebyshevVisibility ),
						momentVisibility: roundMetric( momentVisibility ),
						visibility: roundMetric( visibility ),
						scalarWeight: roundMetric( scalarWeight ),
						baseWeight: roundMetric( baseWeight ),
						visibilityWeight: roundMetric( visibilityWeight ),
						suppression: roundMetric( suppression ),
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
				const varianceValues = rows.map( row => row.variance ).filter( Number.isFinite );
				const hitConfidenceValues = rows.map( row => row.hitConfidence ).filter( Number.isFinite );
				const meanValue = ( values ) => values.length > 0 ?
					values.reduce( ( total, value ) => total + value, 0 ) / values.length :
					null;
				const baseContributionSum = baseCorrect + baseWrong;
				const visibleContributionSum = visibilityCorrect + visibilityWrong;

				return {
					label,
					correctSide,
					sampleKind: surfaceSample?.sampleKind ?? 'center',
					sampleLabel: surfaceSample?.sampleLabel ?? 'center',
					sampleUv: surfaceSample?.uv ?? { u: 0.5, v: 0.5 },
					sampleScreenPixel: surfaceSample?.screenPixel ?? null,
					quadratureWeight: roundMetric( surfaceSample?.quadratureWeight ?? 1 ),
					receiverLocalPosition: roundVector( receiverLocalPosition ),
					receiverPosition: {
						x: roundMetric( receiverPosition.x ),
						y: roundMetric( receiverPosition.y ),
						z: roundMetric( receiverPosition.z )
					},
					receiverNormal: {
						x: roundMetric( receiverNormal.x ),
						y: roundMetric( receiverNormal.y ),
						z: roundMetric( receiverNormal.z )
					},
					sampleNormalBias: roundMetric( activeNormalBias ),
					sampleViewBias: roundMetric( activeViewBias ),
					samplePosition: {
						x: roundMetric( samplePosition.x ),
						y: roundMetric( samplePosition.y ),
						z: roundMetric( samplePosition.z )
					},
					probeCoord: {
						x: roundMetric( probeCoord.x ),
						y: roundMetric( probeCoord.y ),
						z: roundMetric( probeCoord.z )
					},
					baseProbeCoord: {
						x: roundMetric( base.x ),
						y: roundMetric( base.y ),
						z: roundMetric( base.z )
					},
					trilinearBlend: {
						x: roundMetric( blend.x ),
						y: roundMetric( blend.y ),
						z: roundMetric( blend.z )
					},
					selectedProbeIndices: rows.map( row => row.probeIndex ),
					visibilityBiasScale,
					hitConfidencePolicy: hitConfidencePolicy.label,
					runtimeVisibilityPath: useRuntimeVisibilityPath ?
						'gpu-runtime-positionworld-distance-bias' :
						useRuntimeUnguardedVisibilityPath ?
							'gpu-runtime-unguarded-visibility' :
							'legacy-cpu-biased-visibility-position',
					probeMetaPath: useRuntimeProbeMeta ? 'gpu-runtime-probe-meta' : 'legacy-cpu-validity-only-meta',
					normalSource: surfaceSample?.worldNormal !== undefined ? 'gpu-debug-normalWorld' : 'mesh-world-quaternion-local-z',
					visibilityDistanceBias: roundMetric( runtimeVisibilityDistanceBias ),
					visibilityReceiverPosition: {
						x: roundMetric( runtimeVisibilityReceiverPosition.x ),
						y: roundMetric( runtimeVisibilityReceiverPosition.y ),
						z: roundMetric( runtimeVisibilityReceiverPosition.z )
					},
					rows,
					totals: {
						scalarCorrect: roundMetric( scalarCorrect ),
						scalarWrong: roundMetric( scalarWrong ),
						baseCorrect: roundMetric( baseCorrect ),
						baseWrong: roundMetric( baseWrong ),
						visibilityCorrect: roundMetric( visibilityCorrect ),
						visibilityWrong: roundMetric( visibilityWrong ),
						baseSum: roundMetric( baseSum ),
						visibleSum: roundMetric( visibleSum ),
						visibilityMass: roundMetric( visibleSum / Math.max( baseSum, 0.0001 ) ),
						baseWrongContributionRatio: roundMetric( baseWrong / Math.max( baseContributionSum, 0.0001 ) ),
						visibleWrongContributionRatio: roundMetric( visibilityWrong / Math.max( visibleContributionSum, 0.0001 ) ),
						baseCorrectContributionRatio: roundMetric( baseCorrect / Math.max( baseContributionSum, 0.0001 ) ),
						visibleCorrectContributionRatio: roundMetric( visibilityCorrect / Math.max( visibleContributionSum, 0.0001 ) ),
						varianceMin: varianceValues.length > 0 ? roundMetric( Math.min( ...varianceValues ) ) : null,
						varianceMax: varianceValues.length > 0 ? roundMetric( Math.max( ...varianceValues ) ) : null,
						varianceMean: varianceValues.length > 0 ? roundMetric( meanValue( varianceValues ) ) : null,
						hitConfidenceMin: hitConfidenceValues.length > 0 ? roundMetric( Math.min( ...hitConfidenceValues ) ) : null,
						hitConfidenceMax: hitConfidenceValues.length > 0 ? roundMetric( Math.max( ...hitConfidenceValues ) ) : null,
						hitConfidenceMean: hitConfidenceValues.length > 0 ? roundMetric( meanValue( hitConfidenceValues ) ) : null,
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
							octaTexel: row.octaTexel,
							escapeReason: row.escapeReason,
							hitConfidence: row.hitConfidence,
							meanDistance: row.meanDistance,
							receiverDistance: row.receiverDistance,
							delta: row.delta,
							visibility: row.visibility,
							suppression: row.suppression,
							crossesDivider: row.crossesDivider,
							visibilitySegmentDividerAudit: row.visibilitySegmentDividerAudit,
							surfaceSegmentDividerAudit: row.surfaceSegmentDividerAudit
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
				const minReceiver = ( key ) => Math.min( ...receiverRows.map( receiver => receiver.totals[ key ] ?? 0 ) );
				const maxReceiver = ( key ) => Math.max( ...receiverRows.map( receiver => receiver.totals[ key ] ?? 0 ) );
				const correctSuppressionMean = averageComparable( 'correctSuppression' );
				const wrongSuppressionMean = averageComparable( 'wrongSuppression' );
				const wrongMinusCorrectSuppression = wrongSuppressionMean - correctSuppressionMean;
				const visibilityWrongContributionDelta = averageReceiver( 'visibleWrongContributionRatio' ) - averageReceiver( 'baseWrongContributionRatio' );

				return {
					comparableReceiverCount: comparableReceivers.length,
					baseSumMean: roundMetric( averageReceiver( 'baseSum' ) ),
					visibleSumMean: roundMetric( averageReceiver( 'visibleSum' ) ),
					visibilityMassMean: roundMetric( averageReceiver( 'visibilityMass' ) ),
					visibilityMassMin: roundMetric( minReceiver( 'visibilityMass' ) ),
					visibilityMassMax: roundMetric( maxReceiver( 'visibilityMass' ) ),
					baseWrongContributionRatioMean: roundMetric( averageReceiver( 'baseWrongContributionRatio' ) ),
					visibleWrongContributionRatioMean: roundMetric( averageReceiver( 'visibleWrongContributionRatio' ) ),
					wrongContributionRatioDelta: roundMetric( visibilityWrongContributionDelta ),
					varianceMean: roundMetric( averageReceiver( 'varianceMean' ) ),
					hitConfidenceMean: roundMetric( averageReceiver( 'hitConfidenceMean' ) ),
					correctSuppressionMean: roundMetric( correctSuppressionMean ),
					wrongSuppressionMean: roundMetric( wrongSuppressionMean ),
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
					...probe
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

			const createAggregateEvaluation = async ( receiver, weightKey, label, predicate = () => true, coefficientReader = readProbeCoefficients ) => {

				const normal = new THREE.Vector3(
					receiver.receiverNormal.x,
					receiver.receiverNormal.y,
					receiver.receiverNormal.z
				);
				const aggregate = await aggregateReceiverCoefficients( receiver.rows, weightKey, predicate, coefficientReader );
				const irradiance = evaluateProbeCoefficientsForReceiver( aggregate.coefficients, normal );

				return {
					label,
					totalWeight: roundMetric( aggregate.totalWeight ),
					coefficients: aggregate.coefficients,
					irradiance,
					colorBias: createReceiverColorBias( irradiance, receiver.correctSide ),
					chromaticity: createColorChromaticity( irradiance ),
					chromaPressure: createReceiverChromaPressure( irradiance, receiver.correctSide )
				};

			};

			const {
				analyzeReceiverShContributions,
				analyzeShContributionDiagnostics
			} = createLightProbeGridGPUShDiagnostics( {
				_lightProbeContext,
				addScaledCoefficients,
				auditDividerSegment,
				createAggregateEvaluation,
				createColorChromaticity,
				createReceiverChromaPressure,
				createReceiverColorBias,
				createShBandDecomposition,
				createShCoefficientContributionStudy,
				createZeroCoefficients,
				diagnosticState,
				dividerX,
				evaluateIrradianceContract,
				evaluateProbeCoefficientsForReceiver,
				getColorChannel,
				getWrongColorChannel,
				measureNegativeEnergy,
				mixCoefficients,
				readSourceMappedProbeCoefficients,
				readProbeCoefficients,
				resolution,
				roundColor,
				roundMetric,
				roundVector,
				scaleCoefficients,
				shCoefficientTerms,
				visibilityWeightFloor
			} );
			const {
				createGaussLegendreReceiverSamples,
				createReceiverSurfaceQuadratureDiagnostic,
				captureReceiverGpuDebugDiagnostics
			} = createLightProbeGridGPUReceiverDiagnostics( {
				_lightProbeContext,
				analyzeReceiver,
				analyzeReceiverShContributions,
				captureCanvasSample,
				captureLeakRegionMetrics,
				currentHitConfidencePolicy,
				currentVisibilityBiasScale,
				fixtureMode,
				roundColor,
				roundMetric
			} );



			const {
				createCurrentProbePipelineStudy,
				createDilationOracleStudy,
				createSamplingBiasStudy,
				createShDeringingStudy
			} = createLightProbeGridGPUOracleDiagnostics( {
				_lightProbeContext,
				aggregateReceiverCoefficients,
				analyzeReceiver,
				analyzeReceiverShContributions,
				captureLeakRegionMetrics,
				createAggregateEvaluation,
				createGaussLegendreReceiverSamples,
				createReceiverColorBias,
				currentHitConfidencePolicy,
				currentVisibilityBiasScale,
				diagnosticState,
				evaluateIrradianceContract,
				readSourceMappedProbeCoefficients,
				roundColor,
				roundMetric
			} );









			const escapeClassification = combineEscapeSummary( [ left, right ] );
			const shContributionDiagnostic = await analyzeShContributionDiagnostics( left, right, escapeClassification, summary );
			const receiverSurfaceQuadratureDiagnostic = await createReceiverSurfaceQuadratureDiagnostic( shContributionDiagnostic );
			const receiverGpuDebugDiagnostic = await captureReceiverGpuDebugDiagnostics( receiverSurfaceQuadratureDiagnostic );
			const currentProbePipelineStudy = createCurrentProbePipelineStudy();
			const dilationOracleStudy = await createDilationOracleStudy( left, right );
			const samplingBiasStudy = await createSamplingBiasStudy();
			const shDeringingStudy = await createShDeringingStudy( left, right );
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
			const visibilityBiasScales = [ 1, 0.5, 0.25, 0 ];
			const visibilityBiasScaleSweep = [];
			const hitConfidencePolicies = [
				currentHitConfidencePolicy,
				{ label: 'threshold-0.25', mode: 'threshold', threshold: 0.25 },
				{ label: 'threshold-0.1', mode: 'threshold', threshold: 0.1 },
				{ label: 'threshold-0.01', mode: 'threshold', threshold: 0.01 },
				{ label: 'threshold-0', mode: 'threshold', threshold: 0 },
				{ label: 'continuous', mode: 'continuous' },
				{ label: 'always-moment', mode: 'always' },
				{ label: 'ignore-hit', mode: 'ignore' }
			];
			const hitConfidencePolicySweep = [];

			for ( const visibilityBiasScale of visibilityBiasScales ) {

				const sweepLeft = visibilityBiasScale === 1 ? left : await analyzeReceiver( 'leftReceiver', _lightProbeContext.leakFixture.leftReceiver, 'left', visibilityBiasScale );
				const sweepRight = visibilityBiasScale === 1 ? right : await analyzeReceiver( 'rightReceiver', _lightProbeContext.leakFixture.rightReceiver, 'right', visibilityBiasScale );

				visibilityBiasScaleSweep.push( {
					visibilityBiasScale,
					summary: summarizeReceivers( sweepLeft, sweepRight ),
					left: {
						totals: sweepLeft.totals
					},
					right: {
						totals: sweepRight.totals
					}
				} );

			}

			for ( const hitConfidencePolicy of hitConfidencePolicies ) {

				const policyLeft = hitConfidencePolicy === currentHitConfidencePolicy ? left : await analyzeReceiver(
					'leftReceiver',
					_lightProbeContext.leakFixture.leftReceiver,
					'left',
					currentVisibilityBiasScale,
					hitConfidencePolicy
				);
				const policyRight = hitConfidencePolicy === currentHitConfidencePolicy ? right : await analyzeReceiver(
					'rightReceiver',
					_lightProbeContext.leakFixture.rightReceiver,
					'right',
					currentVisibilityBiasScale,
					hitConfidencePolicy
				);

				hitConfidencePolicySweep.push( {
					policy: hitConfidencePolicy,
					summary: summarizeReceivers( policyLeft, policyRight ),
					left: {
						totals: policyLeft.totals
					},
					right: {
						totals: policyRight.totals
					}
				} );

			}

			const bestBiasScale = visibilityBiasScaleSweep.reduce( ( best, row ) =>
				row.summary.wrongMinusCorrectSuppression < best.summary.wrongMinusCorrectSuppression ? row : best
			);
			const bestHitConfidencePolicy = hitConfidencePolicySweep.reduce( ( best, row ) =>
				row.summary.wrongMinusCorrectSuppression < best.summary.wrongMinusCorrectSuppression ? row : best
			);
			const promotionSafeHitConfidencePolicies = hitConfidencePolicySweep.filter( row =>
				row.summary.directionalSuppressionSupported === true &&
				row.summary.correctSuppressionMean >= 0.9 &&
				row.summary.wrongMinusCorrectSuppression <= - 0.05
			);
			const promotionSafeHitConfidencePolicy = promotionSafeHitConfidencePolicies.length > 0 ?
				promotionSafeHitConfidencePolicies[ 0 ] :
				null;

			return {
				status: summary.directionalSuppressionSupported ? 'SUPPORTED-DIRECTIONAL-SUPPRESSION' : 'OPEN-CORRECT-SIDE-SUPPRESSED',
				fixtureMode,
				proofBoundary: fixtureMode === 'thin-wall' ?
					'CPU mirror of current shader weighting for thin-wall receiver centers; diagnostic only, not a public API.' :
					'CPU mirror of current shader weighting for sealed-wall receiver centers; diagnostic only, not a public API.',
				visibilityDepth: typeof _lightProbeContext.probeGrid.getVisibilityDepthInfo === 'function' ? _lightProbeContext.probeGrid.getVisibilityDepthInfo() : { available: false, mode: 'unavailable-proof-6-runtime-removed', resolution: 0, bytes: 0 },
				left,
				right,
				summary,
				escapeClassification,
				shContributionDiagnostic,
				receiverSurfaceQuadratureDiagnostic,
				receiverGpuDebugDiagnostic,
				currentProbePipelineStudy,
				dilationOracleStudy,
				samplingBiasStudy,
				shDeringingStudy,
				interrogationFinding,
				dominantEscapeReason: {
					reason: dominantEscapeReason[ 0 ],
					count: dominantEscapeReason[ 1 ]
				},
				visibilityBiasScaleSweep,
				bestBiasScale: {
					visibilityBiasScale: bestBiasScale.visibilityBiasScale,
					summary: bestBiasScale.summary
				},
				hitConfidencePolicySweep,
				bestHitConfidencePolicy: {
					policy: bestHitConfidencePolicy.policy,
					summary: bestHitConfidencePolicy.summary
				},
				promotionSafeHitConfidencePolicy: promotionSafeHitConfidencePolicy === null ? null : {
					policy: promotionSafeHitConfidencePolicy.policy,
					summary: promotionSafeHitConfidencePolicy.summary
				},
				hitConfidencePolicyDecision: promotionSafeHitConfidencePolicy === null ?
					'OPEN-NO-PROMOTION-SAFE-POLICY' :
					'SUPPORTED-PROMOTION-SAFE-POLICY'
			};

		} finally {

			await restoreState();

		}

	};

	return inspectVisibilityWeightingAtLeakReceivers;

}
