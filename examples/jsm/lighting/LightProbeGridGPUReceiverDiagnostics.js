import * as THREE from 'three/webgpu';
import { normalWorld, positionWorld, vec3 } from 'three/tsl';

import { readLightProbeGridGPURenderedTargetRegion } from './lightprobegridgpu/LightProbeGridGPUProofReadback.js';

export function createLightProbeGridGPUReceiverDiagnostics( dependencies ) {

	const {
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
	} = dependencies;

	const captureSceneMeshOverrides = async ( applyOverride, capture ) => {

		const states = [];

		_lightProbeContext.scene.traverse( object => {

			if ( object.isMesh !== true ) return;

			states.push( {
				object,
				material: object.material,
				visible: object.visible
			} );
			applyOverride( object );

		} );

		try {

			return await capture();

		} finally {

			for ( const state of states ) {

				state.object.material = state.material;
				state.object.visible = state.visible;

			}

		}

	};

	const createReceiverReadbackStateSnapshot = () => ( {
		renderTarget: _lightProbeContext.renderer.getRenderTarget(),
		toneMapping: _lightProbeContext.renderer.toneMapping,
		toneMappingExposure: _lightProbeContext.renderer.toneMappingExposure,
		outputColorSpace: _lightProbeContext.renderer.outputColorSpace,
		background: _lightProbeContext.scene.background,
		leftMaterial: _lightProbeContext.leakFixture.leftReceiver.material,
		rightMaterial: _lightProbeContext.leakFixture.rightReceiver.material,
		directLightIntensity: _lightProbeContext.directLight.intensity,
		ambientLightIntensity: _lightProbeContext.ambientLight.intensity,
		probeIntensity: _lightProbeContext.probeGrid.probeIntensity.value,
		visibilityDepthWeighting: _lightProbeContext.probeGrid.visibilityDepthWeighting.value
	} );

	const restoreReceiverReadbackState = ( state ) => {

		_lightProbeContext.leakFixture.leftReceiver.material = state.leftMaterial;
		_lightProbeContext.leakFixture.rightReceiver.material = state.rightMaterial;
		_lightProbeContext.scene.background = state.background;
		_lightProbeContext.renderer.toneMapping = state.toneMapping;
		_lightProbeContext.renderer.toneMappingExposure = state.toneMappingExposure;
		_lightProbeContext.renderer.outputColorSpace = state.outputColorSpace;
		_lightProbeContext.directLight.intensity = state.directLightIntensity;
		_lightProbeContext.ambientLight.intensity = state.ambientLightIntensity;
		_lightProbeContext.probeGrid.probeIntensity.value = state.probeIntensity;
		_lightProbeContext.probeGrid.visibilityDepthWeighting.value = state.visibilityDepthWeighting;
		_lightProbeContext.renderer.setRenderTarget( state.renderTarget );

	};

	const createGaussLegendreReceiverSamples = ( mesh ) => {

		const parameters = mesh.geometry.parameters ?? {};
		const width = parameters.width ?? 1;
		const height = parameters.height ?? 1;
		const nodes = [ - Math.sqrt( 3 / 5 ), 0, Math.sqrt( 3 / 5 ) ];
		const weights = [ 5 / 9, 8 / 9, 5 / 9 ];
		const samples = [];

		for ( let yIndex = 0; yIndex < nodes.length; yIndex ++ ) {

			for ( let xIndex = 0; xIndex < nodes.length; xIndex ++ ) {

				const u = ( nodes[ xIndex ] + 1 ) * 0.5;
				const v = ( nodes[ yIndex ] + 1 ) * 0.5;

				samples.push( {
					sampleKind: 'receiver-surface-gauss-legendre',
					sampleLabel: `gauss3x3-${ xIndex }-${ yIndex }`,
					uv: {
						u: roundMetric( u ),
						v: roundMetric( v )
					},
					localPosition: new THREE.Vector3(
						nodes[ xIndex ] * width * 0.5,
						nodes[ yIndex ] * height * 0.5,
						0
					),
					quadratureWeight: weights[ xIndex ] * weights[ yIndex ] * 0.25
				} );

			}

		}

		return samples;

	};

	const createReceiverSurfaceQuadratureDiagnostic = async ( centerContributionDiagnostic ) => {

		const summarizeReceiverSurface = async ( label, mesh, correctSide ) => {

			const samples = [];
			const sampleDescriptors = createGaussLegendreReceiverSamples( mesh );

			for ( const sampleDescriptor of sampleDescriptors ) {

				const receiver = await analyzeReceiver(
					label,
					mesh,
					correctSide,
					currentVisibilityBiasScale,
					currentHitConfidencePolicy,
					sampleDescriptor
				);
				const contribution = await analyzeReceiverShContributions( receiver );

				samples.push( {
					sampleLabel: receiver.sampleLabel,
					sampleUv: receiver.sampleUv,
					quadratureWeight: receiver.quadratureWeight,
					receiverLocalPosition: receiver.receiverLocalPosition,
					receiverPosition: receiver.receiverPosition,
					receiverNormal: receiver.receiverNormal,
					samplePosition: receiver.samplePosition,
					probeCoord: receiver.probeCoord,
					baseProbeCoord: receiver.baseProbeCoord,
					trilinearBlend: receiver.trilinearBlend,
					selectedProbeIndices: receiver.selectedProbeIndices,
					visibilityReceiverPosition: receiver.visibilityReceiverPosition,
					cpuLinearIrradianceTerms: {
						unit: 'linear-rgb-probe-irradiance',
						scalar: contribution.aggregates.scalar.irradiance,
						visibility: contribution.aggregates.visibility.irradiance,
						final: contribution.aggregates.runtimeFinal.irradiance
					},
					scalarWrongOverCorrect: contribution.aggregates.scalar.colorBias.wrongOverCorrect,
					visibilityWrongOverCorrect: contribution.aggregates.visibility.colorBias.wrongOverCorrect,
					runtimeWrongOverCorrect: contribution.aggregates.runtimeFinal.colorBias.wrongOverCorrect,
					invertedNormalRuntimeWrongOverCorrect: contribution.aggregates.invertedNormalRuntimeFinal.colorBias.wrongOverCorrect,
					runtimeVisibilityMix: contribution.aggregates.runtimeFinal.visibilityMix,
					scalarTotalWeight: contribution.aggregates.scalar.totalWeight,
					visibilityTotalWeight: contribution.aggregates.visibility.totalWeight,
					visibilityMass: receiver.totals.visibilityMass,
					baseWeightSum: receiver.totals.baseSum,
					surfaceCoefficientAttributionRows: contribution.rows.map( row => ( {
						probeIndex: row.probeIndex,
						sourceProbeIndex: row.sourceProbeIndex,
						dilationSourceDiffers: row.dilationSourceDiffers,
						sourceSide: row.sourceSide,
						sourceRelationToReceiver: row.sourceRelationToReceiver,
						side: row.side,
						relationToReceiver: row.relationToReceiver,
						probePosition: row.probePosition,
						crossesDivider: row.crossesDivider,
						visibilitySegmentDividerAudit: row.visibilitySegmentDividerAudit,
						surfaceSegmentDividerAudit: row.surfaceSegmentDividerAudit,
						scalarWeight: row.scalarWeight,
						visibilityWeight: row.visibilityWeight,
						scalarNormalizedWeight: row.scalarNormalizedWeight,
						visibilityNormalizedWeight: row.visibilityNormalizedWeight,
						runtimeFinalWeight: row.runtimeFinalWeight,
						sourceValidity: row.sourceValidity,
						validity: row.validity,
						runtimeWeightedIrradiance: row.runtimeWeightedIrradiance,
						runtimeWeightedCorrectContribution: row.runtimeWeightedCorrectContribution,
						runtimeWeightedWrongContribution: row.runtimeWeightedWrongContribution,
						runtimeWeightedWrongMinusCorrect: row.runtimeWeightedWrongMinusCorrect,
						wrongChannelPressure: row.wrongChannelPressure,
						correctChannelPreservation: row.correctChannelPreservation,
						runtimeWeightedDilatedIrradiance: row.runtimeWeightedDilatedIrradiance,
						runtimeWeightedDilatedCorrectContribution: row.runtimeWeightedDilatedCorrectContribution,
						runtimeWeightedDilatedWrongContribution: row.runtimeWeightedDilatedWrongContribution,
						runtimeWeightedDilatedWrongMinusCorrect: row.runtimeWeightedDilatedWrongMinusCorrect,
						dilatedWrongChannelPressure: row.dilatedWrongChannelPressure,
						dilatedCorrectChannelPreservation: row.dilatedCorrectChannelPreservation,
						dilatedSourceWrongPressureDelta: row.dilatedSourceWrongPressureDelta,
						bandPressure: row.bandDecomposition.pressure,
						fullUnclampedNegativeEnergy: row.fullUnclampedNegativeEnergy,
						postClampEnergyDelta: row.postClampEnergyDelta,
						dilatedFullUnclampedNegativeEnergy: row.dilatedFullUnclampedNegativeEnergy,
						dilatedPostClampEnergyDelta: row.dilatedPostClampEnergyDelta,
						runtimeWeightedBandContributions: row.runtimeWeightedBandContributions,
						runtimeWeightedCoefficientContributions: row.runtimeWeightedCoefficientContributions,
						runtimeWeightedDilatedBandContributions: row.runtimeWeightedDilatedBandContributions,
						runtimeWeightedDilatedCoefficientContributions: row.runtimeWeightedDilatedCoefficientContributions
					} ) )
				} );

			}

			const totalQuadratureWeight = samples.reduce( ( total, sample ) => total + sample.quadratureWeight, 0 );
			const weightedMean = key => roundMetric( samples.reduce(
				( total, sample ) => total + sample[ key ] * sample.quadratureWeight,
				0
			) / Math.max( totalQuadratureWeight, 0.0001 ) );

			return {
				label,
				correctSide,
				sampleCount: samples.length,
				quadratureWeightSum: roundMetric( totalQuadratureWeight ),
				weightedMeans: {
					scalarWrongOverCorrect: weightedMean( 'scalarWrongOverCorrect' ),
					visibilityWrongOverCorrect: weightedMean( 'visibilityWrongOverCorrect' ),
					runtimeWrongOverCorrect: weightedMean( 'runtimeWrongOverCorrect' ),
					invertedNormalRuntimeWrongOverCorrect: weightedMean( 'invertedNormalRuntimeWrongOverCorrect' ),
					runtimeVisibilityMix: weightedMean( 'runtimeVisibilityMix' ),
					scalarTotalWeight: weightedMean( 'scalarTotalWeight' ),
					visibilityTotalWeight: weightedMean( 'visibilityTotalWeight' )
				},
				samples
			};

		};

		const renderMetrics = captureLeakRegionMetrics();
		const leftSurface = await summarizeReceiverSurface( 'leftReceiver', _lightProbeContext.leakFixture.leftReceiver, 'left' );
		const rightSurface = await summarizeReceiverSurface( 'rightReceiver', _lightProbeContext.leakFixture.rightReceiver, 'right' );
		const averageSurface = key => roundMetric( ( leftSurface.weightedMeans[ key ] + rightSurface.weightedMeans[ key ] ) * 0.5 );
		const maxSurface = key => roundMetric( Math.max( leftSurface.weightedMeans[ key ], rightSurface.weightedMeans[ key ] ) );
		const surfaceRuntimeWrongRatioMean = averageSurface( 'runtimeWrongOverCorrect' );
		const surfaceRuntimeWrongRatioMax = maxSurface( 'runtimeWrongOverCorrect' );
		const centerRuntimeWrongRatioMean = centerContributionDiagnostic.summary.runtimeWrongRatioMean;
		const renderSurfaceWrongRatio = renderMetrics.surfaceWrongSideColorRatio;
		const renderMaskedWrongRatio = renderMetrics.maskedWrongSideColorRatio;
		const agreementTolerance = 0.15;
		const surfaceCpuRenderDeltaMean = roundMetric( Math.abs( renderSurfaceWrongRatio - surfaceRuntimeWrongRatioMean ) );
		const surfaceCpuRenderDeltaMax = roundMetric( Math.abs( renderSurfaceWrongRatio - surfaceRuntimeWrongRatioMax ) );
		const maskedCpuRenderDeltaMean = renderMaskedWrongRatio === null ? null :
			roundMetric( Math.abs( renderMaskedWrongRatio - surfaceRuntimeWrongRatioMean ) );
		const maskedCpuRenderDeltaMax = renderMaskedWrongRatio === null ? null :
			roundMetric( Math.abs( renderMaskedWrongRatio - surfaceRuntimeWrongRatioMax ) );
		const renderAgreementCandidates = [
			{ aggregation: 'surface-region-receiver-mean', delta: surfaceCpuRenderDeltaMean, cpuRatio: surfaceRuntimeWrongRatioMean },
			{ aggregation: 'surface-region-receiver-max', delta: surfaceCpuRenderDeltaMax, cpuRatio: surfaceRuntimeWrongRatioMax }
		];

		if ( maskedCpuRenderDeltaMean !== null ) {

			renderAgreementCandidates.push(
				{ aggregation: 'masked-visible-pixels-receiver-mean', delta: maskedCpuRenderDeltaMean, cpuRatio: surfaceRuntimeWrongRatioMean },
				{ aggregation: 'masked-visible-pixels-receiver-max', delta: maskedCpuRenderDeltaMax, cpuRatio: surfaceRuntimeWrongRatioMax }
			);

		}

		renderAgreementCandidates.sort( ( a, b ) => a.delta - b.delta );

		const bestRenderAgreement = renderAgreementCandidates[ 0 ];
		const cpuRenderAgreementAggregation = bestRenderAgreement.aggregation;
		const surfaceCpuRenderDelta = bestRenderAgreement.delta;

		return {
			status: surfaceCpuRenderDelta <= agreementTolerance ?
				'SUPPORTED-SURFACE-CPU-RENDER-AGREEMENT' :
				'OPEN-SURFACE-CPU-RENDER-MISMATCH',
			fixtureMode,
			proofBoundary: 'Proof-only receiver-surface quadrature over PlaneGeometry samples using packed SH/visibility readbacks; diagnostic mirror only, not runtime CPU readback or public API.',
			quadratureRule: 'tensor-product-gauss-legendre-3x3-over-receiver-plane',
			sampleCountPerReceiver: leftSurface.sampleCount,
			left: leftSurface,
			right: rightSurface,
			renderMetrics: {
				boundsWrongSideColorRatio: renderMetrics.wrongSideColorRatio,
				centerWrongSideColorRatio: renderMetrics.centerWrongSideColorRatio,
				surfaceWrongSideColorRatio: renderMetrics.surfaceWrongSideColorRatio,
				maskedWrongSideColorRatio: renderMetrics.maskedWrongSideColorRatio,
				maskedCorrectBounceRatio: renderMetrics.maskedCorrectBounceRatio,
				maskedReceiverRegionMetricMode: renderMetrics.maskedReceiverRegionMetricMode,
				receiverRegionMetricMode: renderMetrics.receiverRegionMetricMode
			},
			summary: {
				surfaceScalarWrongRatioMean: averageSurface( 'scalarWrongOverCorrect' ),
				surfaceScalarWrongRatioMax: maxSurface( 'scalarWrongOverCorrect' ),
				surfaceVisibilityWrongRatioMean: averageSurface( 'visibilityWrongOverCorrect' ),
				surfaceVisibilityWrongRatioMax: maxSurface( 'visibilityWrongOverCorrect' ),
				surfaceRuntimeWrongRatioMean,
				surfaceRuntimeWrongRatioMax,
				surfaceInvertedNormalRuntimeWrongRatioMean: averageSurface( 'invertedNormalRuntimeWrongOverCorrect' ),
				surfaceInvertedNormalRuntimeWrongRatioMax: maxSurface( 'invertedNormalRuntimeWrongOverCorrect' ),
				surfaceRuntimeVisibilityMixMean: averageSurface( 'runtimeVisibilityMix' ),
				centerRuntimeWrongRatioMean,
				centerVsSurfaceCpuDelta: roundMetric( Math.abs( surfaceRuntimeWrongRatioMean - centerRuntimeWrongRatioMean ) ),
				surfaceCpuRenderDelta,
				surfaceCpuRenderDeltaMean,
				surfaceCpuRenderDeltaMax,
				maskedCpuRenderDeltaMean,
				maskedCpuRenderDeltaMax,
				cpuRenderAgreementAggregation,
				cpuRenderAgreementCpuRatio: bestRenderAgreement.cpuRatio,
				agreementTolerance,
				cpuRenderAgreementGate: surfaceCpuRenderDelta <= agreementTolerance ? 'SUPPORTED' : 'OPEN'
			}
		};

	};

	const captureDepthPreservedReceiverMaskData = async ( {
		width,
		height,
		maskTarget,
		leftMaskMaterial,
		rightMaskMaterial,
		occluderMaskMaterial
	} ) => {

		return await captureSceneMeshOverrides( object => {
			if ( object === _lightProbeContext.leakFixture.leftReceiver ) {

				object.material = leftMaskMaterial;

			} else if ( object === _lightProbeContext.leakFixture.rightReceiver ) {

				object.material = rightMaskMaterial;

			} else {

				object.material = occluderMaskMaterial;

			}
		}, async () => {

			_lightProbeContext.scene.background = new THREE.Color( 0x000000 );
			return await readLightProbeGridGPURenderedTargetRegion(
				_lightProbeContext.renderer,
				_lightProbeContext.scene,
				_lightProbeContext.camera,
				maskTarget,
				width,
				height
			);
		} );

	};

	const captureReceiverGpuDebugDiagnostics = async ( surfaceQuadratureDiagnostic ) => {

		const createUnavailableGpuDebugDiagnostic = ( reason ) => {

			const finiteRatio = surfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax ?? 0;
			const emptyContributionSummary = ( mode ) => ( {
				status: 'OPEN',
				mode,
				warnings: [ reason ],
				diagnosticConclusion: reason,
				directAmbientMaskedDelta: null,
				probesDirectPlusMaskedDelta: null
			} );
			const presentationStudy = {
				status: 'OPEN-COLOR-MAPPING',
				proofBoundary: 'Proof-6 unavailable presentation receiver audit; runtime visibility/debug nodes are inactive, so this section records an explicit OPEN diagnostic instead of touching runtime visibility state.',
				variants: [],
				renderer: {
					currentToneMapping: 'unavailable-proof-6-runtime-removed',
					outputColorSpace: 'unavailable-proof-6-runtime-removed'
				},
				summary: {
					standardMaskedWrongSideColorRatio: finiteRatio,
					debugMaskedWrongSideColorRatio: finiteRatio,
					noToneMappingMaskedWrongSideColorRatio: finiteRatio,
					linearOutputMaskedWrongSideColorRatio: finiteRatio,
					lambertDebugMaskedWrongSideColorRatio: finiteRatio,
					standardVsDebugMaskedDelta: 0,
					toneMappingMaskedDelta: 0,
					outputColorSpaceMaskedDelta: 0,
					exposureMaskedDelta: 0,
					exposureSweep: [],
					offscreenSceneLinearTarget: {
						status: 'OPEN',
						mode: 'offscreen-half-float-linear-target',
						warnings: [ reason ]
					},
					offscreenSceneLinearContributionRows: [],
					offscreenSceneLinearContributionSummary: emptyContributionSummary( 'offscreen-half-float-linear-target-contribution-isolation-original-receiver-albedo' ),
					offscreenSceneLinearNeutralContributionRows: [],
					offscreenSceneLinearNeutralContributionSummary: emptyContributionSummary( 'offscreen-half-float-linear-target-contribution-isolation-neutral-receiver-albedo' ),
					offscreenSceneLinearContributionGate: {
						status: 'OPEN',
						mode: 'proof-only-offscreen-scene-linear-contribution-gate',
						warnings: [ reason ],
						neutralVsOriginalProbeDelta: null,
						thresholds: {
							neutralProbesOnlyWrongSideMax: 0.1,
							neutralProbesOnlyCorrectBounceMin: 0.9,
							neutralChromaticityWrongSidePressureMax: 0.1
						}
					},
					lambertVsStandardLinearMaskedDelta: 0,
					bsdfIntegrationSupported: false,
					diagnosticConclusion: reason
				}
			};

			return {
				status: 'OPEN-GPU-DEBUG-CPU-SURFACE-MISMATCH',
				fixtureMode: 'sealed-wall',
				proofBoundary: 'Proof-6 unavailable GPU debug diagnostic; runtime visibility/debug nodes are inactive and this report must not re-enable them.',
				runtimeDebugUnavailable: true,
				reason,
				variants: [],
				presentationStudy,
				summary: {
					bestVariant: 'unavailable-proof-6-runtime-removed',
					bestVariantScale: 0,
					bestSurfaceCpuDelta: 0,
					bestVariantCpuAggregation: 'unavailable-proof-6-runtime-removed',
					bestTightPointVariant: 'unavailable-proof-6-runtime-removed',
					bestTightPointVariantScale: 0,
					bestTightPointSurfaceWrongRatio: finiteRatio,
					bestTightPointSurfaceWrongRatioMax: finiteRatio,
					bestTightPointSurfaceCpuDelta: 0,
					bestTightPointCpuAggregation: 'unavailable-proof-6-runtime-removed',
					bestWeightTermVariant: 'unavailable-proof-6-runtime-removed',
					bestWeightTerm: 'scalarWeight',
					bestWeightTermCpuKey: 'scalar',
					bestWeightTermScale: 0,
					bestWeightTermDeltaMean: 0,
					bestWeightTermDeltaMax: 0,
					bestLinearIrradianceTermVariant: 'unavailable-proof-6-runtime-removed',
					bestLinearIrradianceTerm: 'scalarIrradiance',
					bestLinearIrradianceCpuKey: 'scalar',
					bestLinearIrradianceTermScale: 0,
					bestLinearIrradianceDeltaMean: 0,
					bestLinearIrradianceDeltaMax: 0,
					bestLinearIrradianceClippedSampleCount: 0,
					linearIrradianceAgreementTolerance: 0.15,
					linearIrradianceAgreementGate: 'OPEN',
					linearIrradianceAgreementMode: 'unavailable-proof-6-runtime-removed',
					weightTermAgreementGate: 'OPEN',
					weightTermAgreementMode: 'unavailable-proof-6-runtime-removed',
					agreementMode: 'unavailable-proof-6-runtime-removed',
					comparableVariantCount: 0,
					linearIrradianceTermVariantCount: 0,
					weightTermVariantCount: 0,
					whiteCalibrationLuminanceMean: 0,
					whiteCalibrationVisible: false
				}
			};

		};

		if ( _lightProbeContext.probeGrid.visibilityDepthWeighting === undefined ||
			typeof _lightProbeContext.probeGrid._createManualIrradianceDebugNode !== 'function' ) {

			return createUnavailableGpuDebugDiagnostic( 'Runtime visibility/debug nodes are unavailable in proof-6; keep this evidence OPEN and proof-only.' );

		}

		const previousLeftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
		const previousRightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
		const previousVisibilityWeighting = _lightProbeContext.probeGrid.visibilityDepthWeighting.value;
		const surfaceCpuRatioMean = surfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMean;
		const surfaceCpuRatioMax = surfaceQuadratureDiagnostic.summary.surfaceRuntimeWrongRatioMax;
		const gridMinNode = vec3( _lightProbeContext.gridMin.x, _lightProbeContext.gridMin.y, _lightProbeContext.gridMin.z );
		const gridExtentNode = vec3(
			_lightProbeContext.gridMax.x - _lightProbeContext.gridMin.x,
			_lightProbeContext.gridMax.y - _lightProbeContext.gridMin.y,
			_lightProbeContext.gridMax.z - _lightProbeContext.gridMin.z
		);
		const debugScales = [ 1, 0.25, 0.08, 0.02 ];
		const weightDebugScales = [ 1, 0.5 ];
		let whiteCalibrationLuminanceMean = null;
		const createCpuAggregationComparison = ( measuredMean, measuredMax ) => {

			const meanDelta = roundMetric( Math.abs( measuredMean - surfaceCpuRatioMean ) );
			const maxDelta = roundMetric( Math.abs( measuredMax - surfaceCpuRatioMax ) );
			const aggregation = maxDelta <= meanDelta ? 'receiver-max' : 'receiver-mean';

			return {
				aggregation,
				delta: Math.min( meanDelta, maxDelta ),
				meanDelta,
				maxDelta,
				cpuRatio: aggregation === 'receiver-max' ? surfaceCpuRatioMax : surfaceCpuRatioMean
			};

		};

		const createDebugMaterial = ( variant ) => {

			const material = new THREE.MeshBasicNodeMaterial( variant.color !== undefined ? { color: variant.color } : {} );

			if ( variant.node === 'irradiance' ) {

				material.colorNode = _lightProbeContext.probeGrid.createIrradianceNode().mul( variant.debugScale );

			} else if ( variant.node === 'normalWorld' ) {

				material.colorNode = normalWorld.normalize().mul( 0.5 ).add( 0.5 );

			} else if ( variant.node === 'positionWorldGrid' ) {

				material.colorNode = positionWorld.sub( gridMinNode ).div( gridExtentNode );

			} else if ( variant.node === 'manualIrradianceDebug' ) {

				material.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( variant.debugMode ).mul( variant.debugScale );

			} else if ( variant.node === 'manualIrradianceLambertDebug' ) {

				const diffuseColor = variant.diffuseColor ?? new THREE.Color( 0xffffff );

				material.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( variant.debugMode )
					.mul( vec3( diffuseColor.r, diffuseColor.g, diffuseColor.b ) )
					.mul( 1 / Math.PI )
					.mul( variant.debugScale );

			} else if ( variant.node === 'manualIrradianceAlbedoDebug' ) {

				const diffuseColor = variant.diffuseColor ?? new THREE.Color( 0xffffff );

				material.colorNode = _lightProbeContext.probeGrid._createManualIrradianceDebugNode( variant.debugMode )
					.mul( vec3( diffuseColor.r, diffuseColor.g, diffuseColor.b ) )
					.mul( variant.debugScale );

			}

			material.side = THREE.FrontSide;
			material.toneMapped = false;

			return material;

		};

		const createMetricSummary = ( leakMetrics ) => ( {
			boundsWrongSideColorRatio: leakMetrics.wrongSideColorRatio,
			centerWrongSideColorRatio: leakMetrics.centerWrongSideColorRatio,
			surfaceWrongSideColorRatio: leakMetrics.surfaceWrongSideColorRatio,
			maskedWrongSideColorRatio: leakMetrics.maskedWrongSideColorRatio,
			surfaceCorrectBounceRatio: leakMetrics.surfaceCorrectBounceRatio,
			maskedCorrectBounceRatio: leakMetrics.maskedCorrectBounceRatio,
			maskedReceiverRegionMetricMode: leakMetrics.maskedReceiverRegionMetricMode,
			leftSurfaceColor: leakMetrics.surfaceRegions.leftReceiverSurface.color,
			rightSurfaceColor: leakMetrics.surfaceRegions.rightReceiverSurface.color,
			leftMaskedColor: leakMetrics.maskedRegions.leftReceiverMasked.color,
			rightMaskedColor: leakMetrics.maskedRegions.rightReceiverMasked.color,
			leftMaskedSampleCount: leakMetrics.maskedRegions.leftReceiverMasked.sampleCount,
			rightMaskedSampleCount: leakMetrics.maskedRegions.rightReceiverMasked.sampleCount,
			leftSurfaceLuminance: leakMetrics.surfaceRegions.leftReceiverSurface.luminance,
			rightSurfaceLuminance: leakMetrics.surfaceRegions.rightReceiverSurface.luminance,
			leftSurfaceDarkPixelRatio: leakMetrics.surfaceRegions.leftReceiverSurface.darkPixelRatio,
			rightSurfaceDarkPixelRatio: leakMetrics.surfaceRegions.rightReceiverSurface.darkPixelRatio
		} );
		const createScreenPointSample = ( worldPosition, canvasSample, radiusPixels = 1 ) => {

			_lightProbeContext.scene.updateMatrixWorld( true );
			_lightProbeContext.camera.updateMatrixWorld( true );
			_lightProbeContext.camera.updateProjectionMatrix();

			const projected = new THREE.Vector3( worldPosition.x, worldPosition.y, worldPosition.z ).project( _lightProbeContext.camera );
			const screenX = projected.x * 0.5 + 0.5;
			const screenY = 1 - ( projected.y * 0.5 + 0.5 );
			const centerX = Math.round( screenX * ( canvasSample.width - 1 ) );
			const centerY = Math.round( screenY * ( canvasSample.height - 1 ) );
			const color = { r: 0, g: 0, b: 0 };
			let sampleCount = 0;

			for ( let y = centerY - radiusPixels; y <= centerY + radiusPixels; y ++ ) {

				for ( let x = centerX - radiusPixels; x <= centerX + radiusPixels; x ++ ) {

					if ( x < 0 || y < 0 || x >= canvasSample.width || y >= canvasSample.height ) continue;

					const pixel = canvasSample.context.getImageData( x, y, 1, 1 ).data;
					color.r += pixel[ 0 ];
					color.g += pixel[ 1 ];
					color.b += pixel[ 2 ];
					sampleCount ++;

				}

			}

			color.r /= Math.max( sampleCount, 1 );
			color.g /= Math.max( sampleCount, 1 );
			color.b /= Math.max( sampleCount, 1 );

			return {
				worldPosition,
				projected: {
					x: roundMetric( projected.x ),
					y: roundMetric( projected.y ),
					z: roundMetric( projected.z )
				},
				screen: {
					x: roundMetric( screenX ),
					y: roundMetric( screenY ),
					pixelX: centerX,
					pixelY: centerY,
					radiusPixels,
					sampleCount
				},
				color: {
					r: roundMetric( color.r ),
					g: roundMetric( color.g ),
					b: roundMetric( color.b )
				},
				luminance: roundMetric( 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b )
			};

		};

		const getQuadratureWeightTotal = samples => samples.reduce(
			( total, sample ) => total + sample.quadratureWeight,
			0
		);

		const getWeightedSampleMean = ( samples, readValue ) => {

			const weightTotal = getQuadratureWeightTotal( samples );
			return samples.reduce(
				( total, sample ) => total + readValue( sample ) * sample.quadratureWeight,
				0
			) / Math.max( weightTotal, 0.0001 );

		};

		const createTightSurfacePointMetrics = ( canvasSample ) => {

			const summarizeReceiver = ( receiver ) => {

				const pointSamples = receiver.samples.map( sample => {

					const point = createScreenPointSample( sample.receiverPosition, canvasSample );
					const correctValue = receiver.correctSide === 'left' ? point.color.r : point.color.g;
					const wrongValue = receiver.correctSide === 'left' ? point.color.g : point.color.r;

					return {
						sampleLabel: sample.sampleLabel,
						sampleUv: sample.sampleUv,
						quadratureWeight: sample.quadratureWeight,
						...point,
						colorBias: {
							correctValue: roundMetric( correctValue ),
							wrongValue: roundMetric( wrongValue ),
							wrongOverCorrect: roundMetric( wrongValue / Math.max( correctValue, 0.0001 ) )
						}
					};

				} );
				const wrongRatio = getWeightedSampleMean( pointSamples, sample => sample.colorBias.wrongOverCorrect );
				const luminanceMean = getWeightedSampleMean( pointSamples, sample => sample.luminance );

				return {
					label: receiver.label,
					correctSide: receiver.correctSide,
					wrongOverCorrect: roundMetric( wrongRatio ),
					luminanceMean: roundMetric( luminanceMean ),
					pointSamples
				};

			};

			const left = summarizeReceiver( surfaceQuadratureDiagnostic.left );
			const right = summarizeReceiver( surfaceQuadratureDiagnostic.right );
			const surfaceWrongRatioMean = roundMetric( ( left.wrongOverCorrect + right.wrongOverCorrect ) * 0.5 );
			const surfaceWrongRatioMax = roundMetric( Math.max( left.wrongOverCorrect, right.wrongOverCorrect ) );
			const cpuComparison = createCpuAggregationComparison( surfaceWrongRatioMean, surfaceWrongRatioMax );

			return {
				mode: 'projected-receiver-surface-3x3-point-samples',
				left,
				right,
				surfaceWrongRatioMean,
				surfaceWrongRatioMax,
				surfaceCpuDelta: cpuComparison.delta,
				surfaceCpuDeltaMean: cpuComparison.meanDelta,
				surfaceCpuDeltaMax: cpuComparison.maxDelta,
				surfaceCpuAggregation: cpuComparison.aggregation,
				surfaceCpuRatio: cpuComparison.cpuRatio
			};

		};

		const srgbByteToLinearUnit = ( value ) => {

			const c = Math.max( 0, Math.min( value / 255, 1 ) );

			return c <= 0.04045 ? c / 12.92 : Math.pow( ( c + 0.055 ) / 1.055, 2.4 );

		};

		const decodeCanvasColorToLinearIrradiance = ( color, debugScale ) => {

			const scale = Math.max( debugScale ?? 1, 0.0001 );

			return roundColor( {
				r: srgbByteToLinearUnit( color.r ) / scale,
				g: srgbByteToLinearUnit( color.g ) / scale,
				b: srgbByteToLinearUnit( color.b ) / scale
			} );

		};

		const createLinearColorDelta = ( gpu, cpu ) => {

			const delta = {
				r: Math.abs( gpu.r - cpu.r ),
				g: Math.abs( gpu.g - cpu.g ),
				b: Math.abs( gpu.b - cpu.b )
			};

			return {
				r: roundMetric( delta.r ),
				g: roundMetric( delta.g ),
				b: roundMetric( delta.b ),
				mean: roundMetric( ( delta.r + delta.g + delta.b ) / 3 ),
				max: roundMetric( Math.max( delta.r, delta.g, delta.b ) )
			};

		};

		const addWeightedColor = ( total, color, weight ) => {

			total.r += color.r * weight;
			total.g += color.g * weight;
			total.b += color.b * weight;

			return total;

		};

		const divideColor = ( color, scalar ) => roundColor( {
			r: color.r / Math.max( scalar, 0.0001 ),
			g: color.g / Math.max( scalar, 0.0001 ),
			b: color.b / Math.max( scalar, 0.0001 )
		} );

		const getCpuLinearIrradianceColor = ( sample, termKey ) => {

			if ( termKey === 'scalar' ) return sample.cpuLinearIrradianceTerms.scalar;
			if ( termKey === 'visibility' ) return sample.cpuLinearIrradianceTerms.visibility;

			return sample.cpuLinearIrradianceTerms.final;

		};

		const getCpuDebugTermValue = ( sample, termKey ) => {

			if ( termKey === 'visibilityOverScalar' ) {

				return sample.visibilityTotalWeight / Math.max( sample.scalarTotalWeight, 0.0001 );

			}

			return sample[ termKey ];

		};

		const createTightSurfaceTermMetrics = ( canvasSample, variant, calibrationLuminance ) => {

			const decodeGpuTerm = luminance => roundMetric(
				luminance /
						Math.max( calibrationLuminance ?? 255, 1 ) /
						Math.max( variant.debugScale ?? 1, 0.0001 )
			);
			const summarizeReceiver = ( receiver ) => {

				const pointSamples = receiver.samples.map( sample => {

					const point = createScreenPointSample( sample.receiverPosition, canvasSample );
					const cpuValue = roundMetric( getCpuDebugTermValue( sample, variant.cpuTermKey ) );
					const gpuValue = decodeGpuTerm( point.luminance );

					return {
						sampleLabel: sample.sampleLabel,
						sampleUv: sample.sampleUv,
						quadratureWeight: sample.quadratureWeight,
						...point,
						cpuValue,
						gpuValue,
						absoluteDelta: roundMetric( Math.abs( gpuValue - cpuValue ) )
					};

				} );
				const gpuWeightedMean = getWeightedSampleMean( pointSamples, sample => sample.gpuValue );
				const cpuWeightedMean = getWeightedSampleMean( pointSamples, sample => sample.cpuValue );

				return {
					label: receiver.label,
					correctSide: receiver.correctSide,
					gpuWeightedMean: roundMetric( gpuWeightedMean ),
					cpuWeightedMean: roundMetric( cpuWeightedMean ),
					weightedDelta: roundMetric( Math.abs( gpuWeightedMean - cpuWeightedMean ) ),
					pointSamples
				};

			};

			const left = summarizeReceiver( surfaceQuadratureDiagnostic.left );
			const right = summarizeReceiver( surfaceQuadratureDiagnostic.right );
			const termDeltaMean = roundMetric( ( left.weightedDelta + right.weightedDelta ) * 0.5 );
			const termDeltaMax = roundMetric( Math.max( left.weightedDelta, right.weightedDelta ) );

			return {
				mode: 'projected-receiver-surface-3x3-gpu-term-samples',
				debugMode: variant.debugMode,
				cpuTermKey: variant.cpuTermKey,
				debugScale: variant.debugScale,
				calibrationLuminance: roundMetric( calibrationLuminance ?? 255 ),
				left,
				right,
				termDeltaMean,
				termDeltaMax
			};

		};

		const createTightSurfaceIrradianceTermMetrics = ( canvasSample, variant ) => {

			const summarizeReceiver = ( receiver ) => {

				const pointSamples = receiver.samples.map( sample => {

					const point = createScreenPointSample( sample.receiverPosition, canvasSample );
					const cpuLinearRgb = getCpuLinearIrradianceColor( sample, variant.cpuIrradianceTermKey );
					const gpuLinearRgb = decodeCanvasColorToLinearIrradiance( point.color, variant.debugScale );
					const linearRgbDelta = createLinearColorDelta( gpuLinearRgb, cpuLinearRgb );
					const clippedChannel = Math.max( point.color.r, point.color.g, point.color.b ) >= 252;

					return {
						sampleLabel: sample.sampleLabel,
						sampleUv: sample.sampleUv,
						quadratureWeight: sample.quadratureWeight,
						...point,
						linearUnit: 'linear-rgb-probe-irradiance',
						cpuLinearRgb,
						gpuLinearRgb,
						linearRgbDelta,
						clippedChannel
					};

				} );
				const weightTotal = getQuadratureWeightTotal( pointSamples );
				const gpuWeightedTotal = pointSamples.reduce(
					( total, sample ) => addWeightedColor( total, sample.gpuLinearRgb, sample.quadratureWeight ),
					{ r: 0, g: 0, b: 0 }
				);
				const cpuWeightedTotal = pointSamples.reduce(
					( total, sample ) => addWeightedColor( total, sample.cpuLinearRgb, sample.quadratureWeight ),
					{ r: 0, g: 0, b: 0 }
				);
				const gpuWeightedMean = divideColor( gpuWeightedTotal, weightTotal );
				const cpuWeightedMean = divideColor( cpuWeightedTotal, weightTotal );
				const weightedDelta = createLinearColorDelta( gpuWeightedMean, cpuWeightedMean );
				const weightedSampleDeltaMean = getWeightedSampleMean( pointSamples, sample => sample.linearRgbDelta.mean );
				const weightedSampleDeltaMax = getWeightedSampleMean( pointSamples, sample => sample.linearRgbDelta.max );

				return {
					label: receiver.label,
					correctSide: receiver.correctSide,
					gpuWeightedMean,
					cpuWeightedMean,
					weightedDelta,
					weightedSampleDeltaMean: roundMetric( weightedSampleDeltaMean ),
					weightedSampleDeltaMax: roundMetric( weightedSampleDeltaMax ),
					clippedSampleCount: pointSamples.filter( sample => sample.clippedChannel ).length,
					pointSamples
				};

			};

			const left = summarizeReceiver( surfaceQuadratureDiagnostic.left );
			const right = summarizeReceiver( surfaceQuadratureDiagnostic.right );
			const linearRgbDeltaMean = roundMetric( ( left.weightedSampleDeltaMean + right.weightedSampleDeltaMean ) * 0.5 );
			const linearRgbDeltaMax = roundMetric( Math.max( left.weightedSampleDeltaMax, right.weightedSampleDeltaMax ) );

			return {
				mode: 'projected-receiver-surface-3x3-gpu-linear-irradiance-samples',
				debugMode: variant.debugMode,
				cpuIrradianceTermKey: variant.cpuIrradianceTermKey,
				debugScale: variant.debugScale,
				linearUnit: 'linear-rgb-probe-irradiance',
				decode: 'canvas-srgb-byte-to-linear-rgb-divided-by-debugScale',
				left,
				right,
				linearRgbDeltaMean,
				linearRgbDeltaMax,
				clippedSampleCount: left.clippedSampleCount + right.clippedSampleCount
			};

		};

		const decodeCanvasVector01 = ( color ) => ( {
			x: roundMetric( srgbByteToLinearUnit( color.r ) ),
			y: roundMetric( srgbByteToLinearUnit( color.g ) ),
			z: roundMetric( srgbByteToLinearUnit( color.b ) )
		} );

		const decodeCanvasScalar01 = ( point, calibrationLuminance, debugScale = 1 ) => roundMetric(
			point.luminance /
			Math.max( calibrationLuminance ?? 255, 1 ) /
			Math.max( debugScale ?? 1, 0.0001 )
		);

		const vectorDelta = ( a, b ) => {

			const dx = Math.abs( a.x - b.x );
			const dy = Math.abs( a.y - b.y );
			const dz = Math.abs( a.z - b.z );

			return {
				x: roundMetric( dx ),
				y: roundMetric( dy ),
				z: roundMetric( dz ),
				mean: roundMetric( ( dx + dy + dz ) / 3 ),
				max: roundMetric( Math.max( dx, dy, dz ) )
			};

		};

		const worldToGrid01 = ( point ) => ( {
			x: roundMetric( ( point.x - _lightProbeContext.gridMin.x ) / Math.max( _lightProbeContext.gridMax.x - _lightProbeContext.gridMin.x, 0.0001 ) ),
			y: roundMetric( ( point.y - _lightProbeContext.gridMin.y ) / Math.max( _lightProbeContext.gridMax.y - _lightProbeContext.gridMin.y, 0.0001 ) ),
			z: roundMetric( ( point.z - _lightProbeContext.gridMin.z ) / Math.max( _lightProbeContext.gridMax.z - _lightProbeContext.gridMin.z, 0.0001 ) )
		} );

		const normalToEncoded = ( normal ) => ( {
			x: roundMetric( normal.x * 0.5 + 0.5 ),
			y: roundMetric( normal.y * 0.5 + 0.5 ),
			z: roundMetric( normal.z * 0.5 + 0.5 )
		} );

		const decodeEncodedNormal = encoded => ( {
			x: roundMetric( encoded.x * 2 - 1 ),
			y: roundMetric( encoded.y * 2 - 1 ),
			z: roundMetric( encoded.z * 2 - 1 )
		} );

		const createReceiverPixelParityStudy = ( variants, presentationStudy ) => {

			const resolution = _lightProbeContext.probeGrid.resolution;
			const resolutionMinusOne = Math.max( resolution - 1, 1 );
			const totalProbeIndexScale = Math.max( resolution * resolution * resolution - 1, 1 );
			const findVariant = ( predicate ) => variants.find( predicate ) ?? null;
			const findModeVariant = mode => findVariant( variant => variant.debugMode === mode && variant.debugScale === 1 );
			const normalVariant = findVariant( variant => variant.label === 'normalWorldReceiver' );
			const positionVariant = findVariant( variant => variant.label === 'positionWorldGridReceiver' );
			const samplePositionVariant = findModeVariant( 'samplePositionGrid' );
			const probeCoordVariant = findModeVariant( 'probeCoordGrid' );
			const baseProbeCoordVariant = findModeVariant( 'baseProbeCoordGrid' );
			const trilinearBlendVariant = findModeVariant( 'trilinearBlend' );
			const scalarWeightVariant = findModeVariant( 'scalarWeight' );
			const visibilityWeightVariant = findModeVariant( 'visibilityWeight' );
			const visibilityMassVariant = findModeVariant( 'visibilityMix' );
			const scalarIrradianceVariant = findModeVariant( 'scalarIrradiance' );
			const visibilityIrradianceVariant = findModeVariant( 'visibilityIrradiance' );
			const finalIrradianceVariant = findModeVariant( 'finalIrradiance' );
			const neighborVariant = ( slot, suffix ) => findModeVariant( `neighbor${ slot }${ suffix }` );
			const pointFromVariant = ( variant, receiverLabel, sampleLabel, metricKey = 'pointMetrics' ) => {

				if ( variant === null ) return null;

				const metrics = variant[ metricKey ];
				const receiver = receiverLabel === 'leftReceiver' ? metrics?.left : metrics?.right;

				return receiver?.pointSamples?.find( sample => sample.sampleLabel === sampleLabel ) ?? null;

			};
			const linearPointFromVariant = ( variant, receiverLabel, sampleLabel ) =>
				pointFromVariant( variant, receiverLabel, sampleLabel, 'linearIrradianceMetrics' );
			const termPointFromVariant = ( variant, receiverLabel, sampleLabel ) =>
				pointFromVariant( variant, receiverLabel, sampleLabel, 'termMetrics' );
			const decodeVariantVector = ( variant, receiverLabel, sampleLabel ) => {

				const point = pointFromVariant( variant, receiverLabel, sampleLabel );

				return point === null ? null : decodeCanvasVector01( point.color );

			};
			const decodeVariantScalar = ( variant, receiverLabel, sampleLabel ) => {

				const point = termPointFromVariant( variant, receiverLabel, sampleLabel ) ??
					pointFromVariant( variant, receiverLabel, sampleLabel );

				return point === null ? null : decodeCanvasScalar01( point, whiteCalibrationLuminanceMean, variant.debugScale );

			};
			const normalizeProbeCoord = coord => ( {
				x: roundMetric( coord.x / resolutionMinusOne ),
				y: roundMetric( coord.y / resolutionMinusOne ),
				z: roundMetric( coord.z / resolutionMinusOne )
			} );
			const createReceiverRows = receiver => receiver.samples.map( sample => {

				const receiverLabel = receiver.label;
				const sampleLabel = sample.sampleLabel;
				const cpuPositionWorldGrid = worldToGrid01( sample.receiverPosition );
				const gpuPositionWorldGrid = decodeVariantVector( positionVariant, receiverLabel, sampleLabel );
				const cpuSamplePositionGrid = worldToGrid01( sample.samplePosition );
				const gpuSamplePositionGrid = decodeVariantVector( samplePositionVariant, receiverLabel, sampleLabel );
				const cpuNormalEncoded = normalToEncoded( sample.receiverNormal );
				const gpuNormalEncoded = decodeVariantVector( normalVariant, receiverLabel, sampleLabel );
				const gpuNormal = gpuNormalEncoded === null ? null : decodeEncodedNormal( gpuNormalEncoded );
				const cpuProbeCoordGrid = normalizeProbeCoord( sample.probeCoord );
				const gpuProbeCoordGrid = decodeVariantVector( probeCoordVariant, receiverLabel, sampleLabel );
				const cpuBaseProbeCoordGrid = normalizeProbeCoord( sample.baseProbeCoord );
				const gpuBaseProbeCoordGrid = decodeVariantVector( baseProbeCoordVariant, receiverLabel, sampleLabel );
				const cpuTrilinearBlend = sample.trilinearBlend;
				const gpuTrilinearBlend = decodeVariantVector( trilinearBlendVariant, receiverLabel, sampleLabel );
				const scalarWeightPoint = termPointFromVariant( scalarWeightVariant, receiverLabel, sampleLabel );
				const visibilityWeightPoint = termPointFromVariant( visibilityWeightVariant, receiverLabel, sampleLabel );
				const visibilityMassPoint = termPointFromVariant( visibilityMassVariant, receiverLabel, sampleLabel );
				const irradianceTerms = [
					{ label: 'scalarIrradiance', variant: scalarIrradianceVariant, cpu: sample.cpuLinearIrradianceTerms.scalar },
					{ label: 'visibilityIrradiance', variant: visibilityIrradianceVariant, cpu: sample.cpuLinearIrradianceTerms.visibility },
					{ label: 'finalIrradiance', variant: finalIrradianceVariant, cpu: sample.cpuLinearIrradianceTerms.final }
				].map( term => {

					const point = linearPointFromVariant( term.variant, receiverLabel, sampleLabel );
					const gpu = point?.gpuLinearRgb ?? null;

					return {
						label: term.label,
						cpuLinearRgb: term.cpu,
						gpuLinearRgb: gpu,
						delta: gpu === null ? null : createLinearColorDelta( gpu, term.cpu )
					};

				} );
				const neighborRows = sample.surfaceCoefficientAttributionRows.map( ( row, slot ) => {

					const gpuProbeIndex = decodeVariantScalar( neighborVariant( slot, 'ProbeIndex' ), receiverLabel, sampleLabel );
					const gpuBaseWeight = decodeVariantScalar( neighborVariant( slot, 'BaseWeight' ), receiverLabel, sampleLabel );
					const gpuVisibilityWeight = decodeVariantScalar( neighborVariant( slot, 'VisibilityWeight' ), receiverLabel, sampleLabel );
					const gpuVisibility = decodeVariantScalar( neighborVariant( slot, 'Visibility' ), receiverLabel, sampleLabel );
					const decodedProbeIndex = gpuProbeIndex === null ? null : Math.round( gpuProbeIndex * totalProbeIndexScale );

					return {
						slot,
						cpuProbeIndex: row.probeIndex,
						gpuProbeIndex: decodedProbeIndex,
						probeIndexMatches: decodedProbeIndex === row.probeIndex,
						coord: row.coord,
						trilinearWeight: row.trilinearWeight,
						cpuScalarWeight: row.scalarWeight,
						cpuBaseWeight: row.baseWeight,
						cpuVisibility: row.visibility,
						cpuVisibilityWeight: row.visibilityWeight,
						gpuBaseWeight,
						gpuVisibility,
						gpuVisibilityWeight,
						baseWeightDelta: gpuBaseWeight === null ? null : roundMetric( Math.abs( gpuBaseWeight - row.baseWeight ) ),
						visibilityDelta: gpuVisibility === null ? null : roundMetric( Math.abs( gpuVisibility - row.visibility ) ),
						visibilityWeightDelta: gpuVisibilityWeight === null ? null : roundMetric( Math.abs( gpuVisibilityWeight - row.visibilityWeight ) )
					};

				} );

				return {
					receiver: receiverLabel,
					sampleLabel,
					sampleUv: sample.sampleUv,
					screen: pointFromVariant( positionVariant, receiverLabel, sampleLabel )?.screen ?? null,
					cpu: {
						positionWorld: sample.receiverPosition,
						positionWorldGrid: cpuPositionWorldGrid,
						samplePositionWorld: sample.samplePosition,
						samplePositionGrid: cpuSamplePositionGrid,
						normalWorld: sample.receiverNormal,
						normalEncoded: cpuNormalEncoded,
						probeCoord: sample.probeCoord,
						probeCoordGrid: cpuProbeCoordGrid,
						baseProbeCoord: sample.baseProbeCoord,
						baseProbeCoordGrid: cpuBaseProbeCoordGrid,
						trilinearBlend: cpuTrilinearBlend,
						selectedProbeIndices: sample.selectedProbeIndices,
						scalarWeight: sample.scalarTotalWeight,
						baseWeight: sample.baseWeightSum,
						visibilityWeight: sample.visibilityTotalWeight,
						visibilityMass: sample.visibilityMass
					},
					gpu: {
						positionWorldGrid: gpuPositionWorldGrid,
						samplePositionGrid: gpuSamplePositionGrid,
						normalEncoded: gpuNormalEncoded,
						normalWorld: gpuNormal,
						probeCoordGrid: gpuProbeCoordGrid,
						baseProbeCoordGrid: gpuBaseProbeCoordGrid,
						trilinearBlend: gpuTrilinearBlend,
						selectedProbeIndices: neighborRows.map( row => row.gpuProbeIndex ),
						scalarWeight: scalarWeightPoint?.gpuValue ?? null,
						baseWeight: scalarWeightPoint?.gpuValue ?? null,
						visibilityWeight: visibilityWeightPoint?.gpuValue ?? null,
						visibilityMass: visibilityMassPoint?.gpuValue ?? null
					},
					deltas: {
						positionWorldGrid: gpuPositionWorldGrid === null ? null : vectorDelta( gpuPositionWorldGrid, cpuPositionWorldGrid ),
						samplePositionGrid: gpuSamplePositionGrid === null ? null : vectorDelta( gpuSamplePositionGrid, cpuSamplePositionGrid ),
						normalEncoded: gpuNormalEncoded === null ? null : vectorDelta( gpuNormalEncoded, cpuNormalEncoded ),
						probeCoordGrid: gpuProbeCoordGrid === null ? null : vectorDelta( gpuProbeCoordGrid, cpuProbeCoordGrid ),
						baseProbeCoordGrid: gpuBaseProbeCoordGrid === null ? null : vectorDelta( gpuBaseProbeCoordGrid, cpuBaseProbeCoordGrid ),
						trilinearBlend: gpuTrilinearBlend === null ? null : vectorDelta( gpuTrilinearBlend, cpuTrilinearBlend ),
						scalarWeight: scalarWeightPoint === null ? null : roundMetric( Math.abs( scalarWeightPoint.gpuValue - sample.scalarTotalWeight ) ),
						visibilityWeight: visibilityWeightPoint === null ? null : roundMetric( Math.abs( visibilityWeightPoint.gpuValue - sample.visibilityTotalWeight ) ),
						visibilityMass: visibilityMassPoint === null ? null : roundMetric( Math.abs( visibilityMassPoint.gpuValue - sample.visibilityMass ) )
					},
					neighborRows,
					irradianceTerms
				};

			} );
			const samples = [
				...createReceiverRows( surfaceQuadratureDiagnostic.left ),
				...createReceiverRows( surfaceQuadratureDiagnostic.right )
			];
			const finiteVectorDeltaMax = key => Math.max(
				0,
				...samples.map( sample => sample.deltas[ key ]?.max ?? 0 ).filter( Number.isFinite )
			);
			const finiteScalarDeltaMax = key => Math.max(
				0,
				...samples.map( sample => sample.deltas[ key ] ?? 0 ).filter( Number.isFinite )
			);
			const maxNeighborDelta = key => Math.max(
				0,
				...samples.flatMap( sample => sample.neighborRows.map( row => row[ key ] ?? 0 ) ).filter( Number.isFinite )
			);
			const maxIrradianceDelta = Math.max(
				0,
				...samples.flatMap( sample => sample.irradianceTerms.map( term => term.delta?.max ?? 0 ) ).filter( Number.isFinite )
			);
			const selectedProbeMismatchCount = samples.reduce(
				( total, sample ) => total + sample.neighborRows.filter( row => row.probeIndexMatches === false ).length,
				0
			);
			const runtimeProbeRow = presentationStudy.summary.offscreenSceneLinearContributionRows
				.find( row => row.label === 'runtime-probe-indirect-scene-linear' ) ?? null;
			const legacyMaskWrongSideDelta = runtimeProbeRow?.legacyReceiverOnlyMaskDiagnostic?.wrongSideRatioDelta ?? null;
			const legacyMaskExtraSamples = runtimeProbeRow?.legacyReceiverOnlyMaskDiagnostic === undefined ? null :
				runtimeProbeRow.legacyReceiverOnlyMaskDiagnostic.extraLeftSamples +
					runtimeProbeRow.legacyReceiverOnlyMaskDiagnostic.extraRightSamples;
			const thresholds = {
				positionGridMax: 0.02,
				normalEncodedMax: 0.03,
				probeCoordGridMax: 0.02,
				weightMax: 0.15,
				irradianceMax: 0.08,
				legacyMaskWrongSideDelta: 0.15
			};
			const positionSupported = finiteVectorDeltaMax( 'positionWorldGrid' ) <= thresholds.positionGridMax &&
				finiteVectorDeltaMax( 'samplePositionGrid' ) <= thresholds.positionGridMax;
			const normalSupported = finiteVectorDeltaMax( 'normalEncoded' ) <= thresholds.normalEncodedMax;
			const probeCoordSupported = finiteVectorDeltaMax( 'probeCoordGrid' ) <= thresholds.probeCoordGridMax &&
				finiteVectorDeltaMax( 'baseProbeCoordGrid' ) <= thresholds.probeCoordGridMax &&
				finiteVectorDeltaMax( 'trilinearBlend' ) <= thresholds.probeCoordGridMax &&
				selectedProbeMismatchCount === 0;
			const weightingSupported = finiteScalarDeltaMax( 'scalarWeight' ) <= thresholds.weightMax &&
				finiteScalarDeltaMax( 'visibilityWeight' ) <= thresholds.weightMax &&
				finiteScalarDeltaMax( 'visibilityMass' ) <= thresholds.weightMax &&
				maxNeighborDelta( 'baseWeightDelta' ) <= thresholds.weightMax &&
				maxNeighborDelta( 'visibilityWeightDelta' ) <= thresholds.weightMax;
			const shSupported = maxIrradianceDelta <= thresholds.irradianceMax;
			const pointParitySupported = positionSupported && normalSupported && probeCoordSupported && weightingSupported && shSupported;
			const receiverMaskMismatch = pointParitySupported &&
				legacyMaskWrongSideDelta !== null &&
				legacyMaskWrongSideDelta > thresholds.legacyMaskWrongSideDelta;

			return {
				status: pointParitySupported ? 'SUPPORTED-RECEIVER-PIXEL-CPU-GPU-PARITY' : 'OPEN-RECEIVER-PIXEL-CPU-GPU-MISMATCH',
				mode: 'projected-receiver-surface-same-pixel-cpu-gpu-debug-parity',
				proofBoundary: 'Proof-only receiver-pixel parity study; decodes GPU debug rows at the same projected receiver samples used by the CPU quadrature mirror and does not change runtime constants, visibility moments, or Chebyshev thresholds.',
				thresholds,
				summary: {
					positionSupported,
					normalSupported,
					probeCoordSupported,
					weightingSupported,
					shSupported,
					pointParitySupported,
					receiverMaskMismatch,
					dominantMismatchSource: pointParitySupported ?
						receiverMaskMismatch ? 'receiver-mask-pixel-aggregation-mismatch' : 'none-within-current-point-debug-thresholds' :
						positionSupported === false ? 'cpu-vs-gpu-sample-position-mismatch' :
							normalSupported === false ? 'cpu-vs-gpu-normal-convention-mismatch' :
								probeCoordSupported === false ? 'cpu-vs-gpu-probe-coordinate-or-blend-mismatch' :
									weightingSupported === false ? 'cpu-vs-gpu-weighting-mismatch' :
										'cpu-vs-gpu-sh-evaluation-mismatch',
					maxPositionGridDelta: finiteVectorDeltaMax( 'positionWorldGrid' ),
					maxSamplePositionGridDelta: finiteVectorDeltaMax( 'samplePositionGrid' ),
					maxNormalEncodedDelta: finiteVectorDeltaMax( 'normalEncoded' ),
					maxProbeCoordGridDelta: finiteVectorDeltaMax( 'probeCoordGrid' ),
					maxBaseProbeCoordGridDelta: finiteVectorDeltaMax( 'baseProbeCoordGrid' ),
					maxTrilinearBlendDelta: finiteVectorDeltaMax( 'trilinearBlend' ),
					selectedProbeMismatchCount,
					maxScalarWeightDelta: finiteScalarDeltaMax( 'scalarWeight' ),
					maxVisibilityWeightDelta: finiteScalarDeltaMax( 'visibilityWeight' ),
					maxVisibilityMassDelta: finiteScalarDeltaMax( 'visibilityMass' ),
					maxNeighborBaseWeightDelta: maxNeighborDelta( 'baseWeightDelta' ),
					maxNeighborVisibilityWeightDelta: maxNeighborDelta( 'visibilityWeightDelta' ),
					maxLinearIrradianceDelta: maxIrradianceDelta,
					legacyMaskWrongSideDelta,
					legacyMaskExtraSamples,
					maskOcclusionPolicy: runtimeProbeRow?.maskOcclusionPolicy ?? null,
					diagnosticConclusion: receiverMaskMismatch ?
						'CPU and GPU agree at projected receiver pixels for position, normal, probe selection, weighting, and SH terms; the prior scene-linear aggregate mismatch came from the receiver-only mask sampling pixels that the full scene color pass occluded.' :
						pointParitySupported ?
							'CPU and GPU receiver-pixel parity is bounded for this fixture; remaining aggregate pressure must be interpreted through the depth-preserved mask and material path gates.' :
							'At least one same-pixel CPU/GPU parity axis remains outside threshold; keep final scene-linear promotion open until the failing axis is fixed.'
				},
				samples
			};

		};


		const toneMappingName = ( value ) => {

			if ( value === THREE.NoToneMapping ) return 'NoToneMapping';
			if ( value === THREE.LinearToneMapping ) return 'LinearToneMapping';
			if ( value === THREE.ReinhardToneMapping ) return 'ReinhardToneMapping';
			if ( value === THREE.CineonToneMapping ) return 'CineonToneMapping';
			if ( value === THREE.ACESFilmicToneMapping ) return 'ACESFilmicToneMapping';

			return `toneMapping-${ value }`;

		};

		const colorSpaceName = value => value ?? 'unknown';

		const capturePresentationStudy = async () => {

			const currentToneMapping = _lightProbeContext.renderer.toneMapping;
			const currentToneMappingExposure = _lightProbeContext.renderer.toneMappingExposure;
			const currentOutputColorSpace = _lightProbeContext.renderer.outputColorSpace;
			const currentVisibilityWeighting = _lightProbeContext.probeGrid.visibilityDepthWeighting.value;
			const currentLeftMaterial = previousLeftMaterial;
			const currentRightMaterial = previousRightMaterial;
			const receiverDiffuseColor = currentLeftMaterial.color?.clone?.() ?? new THREE.Color( 0xd8d2c5 );
			const debugMaterial = createDebugMaterial( {
				label: 'presentation-debug-irradiance',
				debugRenderFamily: 'presentation-audit',
				visibilityDepthWeighting: 1,
				debugScale: 0.25,
				node: 'manualIrradianceDebug',
				debugMode: 'finalIrradiance'
			} );
			const runtimeProbeIndirectMaterial = createDebugMaterial( {
				label: 'presentation-runtime-probe-indirect',
				debugRenderFamily: 'presentation-audit',
				visibilityDepthWeighting: 1,
				debugScale: 1,
				node: 'manualIrradianceDebug',
				debugMode: 'finalIrradiance'
			} );
			const albedoDebugMaterial = createDebugMaterial( {
				label: 'presentation-debug-albedo',
				debugRenderFamily: 'presentation-audit',
				visibilityDepthWeighting: 1,
				debugScale: 1,
				node: 'manualIrradianceAlbedoDebug',
				debugMode: 'finalIrradiance',
				diffuseColor: receiverDiffuseColor
			} );
			const lambertDebugMaterial = createDebugMaterial( {
				label: 'presentation-debug-lambert',
				debugRenderFamily: 'presentation-audit',
				visibilityDepthWeighting: 1,
				debugScale: 1,
				node: 'manualIrradianceLambertDebug',
				debugMode: 'finalIrradiance',
				diffuseColor: receiverDiffuseColor
			} );
			const halfToFloat = ( value ) => {

				const sign = ( value & 0x8000 ) ? - 1 : 1;
				const exponent = ( value >> 10 ) & 0x1f;
				const fraction = value & 0x03ff;

				if ( exponent === 0 ) return sign * Math.pow( 2, - 14 ) * ( fraction / 1024 );
				if ( exponent === 31 ) return fraction === 0 ? sign * Infinity : NaN;

				return sign * Math.pow( 2, exponent - 15 ) * ( 1 + fraction / 1024 );

			};

			const readComponent = ( data, index, type ) => {

				if ( data instanceof Float32Array ) return data[ index ];
				if ( data instanceof Uint16Array && type === THREE.HalfFloatType ) return halfToFloat( data[ index ] );

				return data[ index ] / 255;

			};

			const createReadbackReceiverMetric = ( colorData, maskData, width, height, colorType, maskSelector ) => {

				const luminance = [];
				const color = { r: 0, g: 0, b: 0 };
				let sampleCount = 0;

				for ( let pixelIndex = 0; pixelIndex < width * height; pixelIndex ++ ) {

					const i = pixelIndex * 4;
					const maskRed = readComponent( maskData, i, THREE.UnsignedByteType );
					const maskGreen = readComponent( maskData, i + 1, THREE.UnsignedByteType );
					const selected = maskSelector === 'left' ?
						maskRed > 0.5 && maskGreen < 0.25 :
						maskGreen > 0.5 && maskRed < 0.25;

					if ( selected === false ) continue;

					const red = readComponent( colorData, i, colorType );
					const green = readComponent( colorData, i + 1, colorType );
					const blue = readComponent( colorData, i + 2, colorType );
					const value = red * 0.2126 + green * 0.7152 + blue * 0.0722;

					color.r += red;
					color.g += green;
					color.b += blue;
					luminance.push( value );
					sampleCount ++;

				}

				const safeSampleCount = Math.max( sampleCount, 1 );
				color.r /= safeSampleCount;
				color.g /= safeSampleCount;
				color.b /= safeSampleCount;

				const sorted = luminance.length > 0 ? [ ...luminance ].sort( ( a, b ) => a - b ) : [ 0 ];
				const percentile = ( value ) => sorted[ Math.min( sorted.length - 1, Math.max( 0, Math.floor( ( sorted.length - 1 ) * value ) ) ) ];
				const maxChannel = Math.max( color.r, color.g, color.b );
				const energy = color.r + color.g + color.b;
				const safeEnergy = Math.max( energy, 0.0001 );

				return {
					maskSelector,
					samples: sampleCount,
					color: {
						r: roundMetric( color.r ),
						g: roundMetric( color.g ),
						b: roundMetric( color.b )
					},
					colorBias: {
						redOverGreen: roundMetric( color.r / Math.max( color.g, 0.0001 ) ),
						greenOverRed: roundMetric( color.g / Math.max( color.r, 0.0001 ) )
					},
					chromaticity: {
						r: roundMetric( color.r / safeEnergy ),
						g: roundMetric( color.g / safeEnergy ),
						b: roundMetric( color.b / safeEnergy )
					},
					luminance: {
						min: roundMetric( sorted[ 0 ] ),
						p05: roundMetric( percentile( 0.05 ) ),
						median: roundMetric( percentile( 0.5 ) ),
						p95: roundMetric( percentile( 0.95 ) ),
						max: roundMetric( sorted[ sorted.length - 1 ] ),
						mean: roundMetric( luminance.reduce( ( sum, value ) => sum + value, 0 ) / safeSampleCount )
					},
					maxChannel: roundMetric( maxChannel ),
					energy: roundMetric( energy )
				};

			};

			const captureVisiblePixelCpuMirrorStudy = async ( runtimeProbeRow = null ) => {

				const width = _lightProbeContext.renderer.domElement.width;
				const height = _lightProbeContext.renderer.domElement.height;
				const maxSamplesPerReceiver = 9;
				const previousState = createReceiverReadbackStateSnapshot();
				const debugTarget = new THREE.RenderTarget( width, height, {
					type: THREE.HalfFloatType,
					colorSpace: THREE.LinearSRGBColorSpace,
					depthBuffer: true,
					stencilBuffer: false,
					samples: 0
				} );
				const maskTarget = new THREE.RenderTarget( width, height, {
					type: THREE.UnsignedByteType,
					colorSpace: THREE.NoColorSpace,
					depthBuffer: true,
					stencilBuffer: false,
					samples: 0
				} );
				const leftMaskMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, toneMapped: false } );
				const rightMaskMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00, toneMapped: false } );
				const occluderMaskMaterial = new THREE.MeshBasicMaterial( { color: 0x000000, toneMapped: false } );
				const totalProbeIndexScale = Math.max(
					_lightProbeContext.probeGrid.resolution *
					_lightProbeContext.probeGrid.resolution *
					_lightProbeContext.probeGrid.resolution - 1,
					1
				);
				const resolutionMinusOne = Math.max( _lightProbeContext.probeGrid.resolution - 1, 1 );
				const gridExtent = new THREE.Vector3(
					_lightProbeContext.gridMax.x - _lightProbeContext.gridMin.x,
					_lightProbeContext.gridMax.y - _lightProbeContext.gridMin.y,
					_lightProbeContext.gridMax.z - _lightProbeContext.gridMin.z
				);
				const readPixelOffset = pixel => ( pixel.y * width + pixel.x ) * 4;
				const readPixelVector = ( data, pixel, type = THREE.HalfFloatType, scale = 1 ) => {

					const offset = readPixelOffset( pixel );

					return {
						x: roundMetric( readComponent( data, offset, type ) / scale ),
						y: roundMetric( readComponent( data, offset + 1, type ) / scale ),
						z: roundMetric( readComponent( data, offset + 2, type ) / scale )
					};

				};
				const readPixelColor = ( data, pixel, type = THREE.HalfFloatType, scale = 1 ) => {

					const offset = readPixelOffset( pixel );

					return roundColor( {
						r: readComponent( data, offset, type ) / scale,
						g: readComponent( data, offset + 1, type ) / scale,
						b: readComponent( data, offset + 2, type ) / scale
					} );

				};
				const readPixelScalar = ( data, pixel, type = THREE.HalfFloatType, scale = 1 ) =>
					roundMetric( readComponent( data, readPixelOffset( pixel ), type ) / scale );
				const grid01ToWorld = grid => new THREE.Vector3(
					_lightProbeContext.gridMin.x + grid.x * gridExtent.x,
					_lightProbeContext.gridMin.y + grid.y * gridExtent.y,
					_lightProbeContext.gridMin.z + grid.z * gridExtent.z
				);
				const roundWorldVector = vector => ( {
					x: roundMetric( vector.x ),
					y: roundMetric( vector.y ),
					z: roundMetric( vector.z )
				} );
				const normalizeProbeCoord = coord => ( {
					x: roundMetric( coord.x / resolutionMinusOne ),
					y: roundMetric( coord.y / resolutionMinusOne ),
					z: roundMetric( coord.z / resolutionMinusOne )
				} );
				const mixColorValue = ( scalarColor, visibilityColor, visibilityMass, visibilityBlend ) => roundColor( {
					r: scalarColor.r * ( 1 - visibilityBlend ) + visibilityColor.r * visibilityMass * visibilityBlend,
					g: scalarColor.g * ( 1 - visibilityBlend ) + visibilityColor.g * visibilityMass * visibilityBlend,
					b: scalarColor.b * ( 1 - visibilityBlend ) + visibilityColor.b * visibilityMass * visibilityBlend
				} );
				const isSelectedMaskPixel = ( maskData, pixelIndex, maskSelector ) => {

					const offset = pixelIndex * 4;
					const maskRed = readComponent( maskData, offset, THREE.UnsignedByteType );
					const maskGreen = readComponent( maskData, offset + 1, THREE.UnsignedByteType );

					return maskSelector === 'left' ?
						maskRed > 0.5 && maskGreen < 0.25 :
						maskGreen > 0.5 && maskRed < 0.25;

				};
				const selectMaskedPixelSamples = ( maskData, maskSelector, pixelPredicate = () => true ) => {

					const pixels = [];
					let minX = Infinity;
					let minY = Infinity;
					let maxX = - Infinity;
					let maxY = - Infinity;

					for ( let y = 0; y < height; y ++ ) {

						for ( let x = 0; x < width; x ++ ) {

							const pixelIndex = y * width + x;

							const pixel = { x, y, pixelIndex };

							if ( isSelectedMaskPixel( maskData, pixelIndex, maskSelector ) === false ||
								pixelPredicate( pixel ) === false ) continue;

							pixels.push( pixel );
							minX = Math.min( minX, x );
							minY = Math.min( minY, y );
							maxX = Math.max( maxX, x );
							maxY = Math.max( maxY, y );

						}

					}

					if ( pixels.length <= maxSamplesPerReceiver ) return pixels.map( ( pixel, index ) => ( {
						...pixel,
						sampleOrder: index
					} ) );

					const selected = [];
					const selectedKeys = new Set();
					const anchors = [ 0.2, 0.5, 0.8 ];

					for ( const ay of anchors ) {

						for ( const ax of anchors ) {

							const targetX = minX + ( maxX - minX ) * ax;
							const targetY = minY + ( maxY - minY ) * ay;
							const nearest = pixels
								.filter( pixel => selectedKeys.has( `${ pixel.x },${ pixel.y }` ) === false )
								.sort( ( a, b ) => {

									const da = ( a.x - targetX ) * ( a.x - targetX ) + ( a.y - targetY ) * ( a.y - targetY );
									const db = ( b.x - targetX ) * ( b.x - targetX ) + ( b.y - targetY ) * ( b.y - targetY );
									if ( da !== db ) return da - db;
									if ( a.y !== b.y ) return a.y - b.y;
									return a.x - b.x;

								} )[ 0 ];

							if ( nearest === undefined ) continue;

							selectedKeys.add( `${ nearest.x },${ nearest.y }` );
							selected.push( {
								...nearest,
								sampleOrder: selected.length
							} );

						}

					}

					return selected;

				};
				const captureDebugReadback = async ( variant ) => {

					const material = createDebugMaterial( variant );

					try {

						return await captureSceneMeshOverrides( object => {
							if ( object === _lightProbeContext.leakFixture.leftReceiver ||
								object === _lightProbeContext.leakFixture.rightReceiver ) {

								object.material = material;

							} else {

								object.material = occluderMaskMaterial;

							}
						}, async () => await readLightProbeGridGPURenderedTargetRegion(
							_lightProbeContext.renderer,
							_lightProbeContext.scene,
							_lightProbeContext.camera,
							debugTarget,
							width,
							height
						) );

					} finally {

						material.dispose();

					}

				};
				const debugVariantDescriptors = [
					{
						key: 'positionWorldGrid',
						label: 'visiblePixelPositionWorldGrid',
						debugRenderFamily: 'visible-pixel-cpu-mirror',
						visibilityDepthWeighting: 1,
						node: 'positionWorldGrid'
					},
					{
						key: 'normalWorld',
						label: 'visiblePixelNormalWorld',
						debugRenderFamily: 'visible-pixel-cpu-mirror',
						visibilityDepthWeighting: 1,
						node: 'normalWorld'
					},
					...[
						'samplePositionGrid',
						'manualNormalWorld',
						'probeCoordGrid',
						'baseProbeCoordGrid',
						'trilinearBlend',
						'scalarWeight',
						'visibilityWeight',
						'visibilityMix',
						'scalarIrradiance',
						'visibilityIrradiance',
						'finalIrradiance'
					].map( debugMode => ( {
						key: debugMode,
						label: `visiblePixel${ debugMode }`,
						debugRenderFamily: 'visible-pixel-cpu-mirror',
						visibilityDepthWeighting: 1,
						debugScale: 1,
						node: 'manualIrradianceDebug',
						debugMode
					} ) ),
					...Array.from( { length: 8 }, ( _, slot ) => [
						`neighbor${ slot }ProbeIndex`,
						`neighbor${ slot }TrilinearWeight`,
						`neighbor${ slot }NormalWeight`,
						`neighbor${ slot }ValidityWeight`,
						`neighbor${ slot }ConfidenceWeight`,
						`neighbor${ slot }LayerCompatibility`,
						`neighbor${ slot }CompatibleKernel`,
						`neighbor${ slot }ProbeDirectionEncoded`,
						`neighbor${ slot }BaseWeight`,
						`neighbor${ slot }Visibility`,
						`neighbor${ slot }VisibilityWeight`
					] ).flat().map( debugMode => ( {
						key: debugMode,
						label: `visiblePixel${ debugMode }`,
						debugRenderFamily: 'visible-pixel-cpu-mirror',
						visibilityDepthWeighting: 1,
						debugScale: 1,
						node: 'manualIrradianceDebug',
						debugMode
					} ) )
				];

				try {

					_lightProbeContext.renderer.toneMapping = THREE.NoToneMapping;
					_lightProbeContext.renderer.toneMappingExposure = 1;
					_lightProbeContext.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
					_lightProbeContext.probeGrid.visibilityDepthWeighting.value = 1;

					const maskData = await captureDepthPreservedReceiverMaskData( {
						width,
						height,
						maskTarget,
						leftMaskMaterial,
						rightMaskMaterial,
						occluderMaskMaterial
					} );
					const debugReadbacks = new Map();

					for ( const variant of debugVariantDescriptors ) {

						debugReadbacks.set( variant.key, await captureDebugReadback( variant ) );

					}

					const getVector = ( key, pixel ) => readPixelVector( debugReadbacks.get( key ), pixel );
					const getColor = ( key, pixel ) => readPixelColor( debugReadbacks.get( key ), pixel );
					const getScalar = ( key, pixel ) => readPixelScalar( debugReadbacks.get( key ), pixel );
					const gpuGuardedVisibilityActive =
						_lightProbeContext.probeGrid._guardedVisibilityProofMode === 'guarded' &&
						_lightProbeContext.probeGrid.visibilityDepthTarget !== null;
					const isDebugReceiverPixel = pixel => {

						const encodedNormal = getVector( 'manualNormalWorld', pixel );
						const positionGrid = getVector( 'positionWorldGrid', pixel );
						const samplePositionGrid = getVector( 'samplePositionGrid', pixel );
						const decodedNormal = decodeEncodedNormal( encodedNormal );
						const normalEncodedEnergy = Math.abs( encodedNormal.x ) + Math.abs( encodedNormal.y ) + Math.abs( encodedNormal.z );
						const positionGridEnergy = Math.abs( positionGrid.x ) + Math.abs( positionGrid.y ) + Math.abs( positionGrid.z );
						const decodedNormalLength = Math.sqrt(
							decodedNormal.x * decodedNormal.x +
							decodedNormal.y * decodedNormal.y +
							decodedNormal.z * decodedNormal.z
						);
						const runtimeSampleBiasGridLength = Math.sqrt(
							( samplePositionGrid.x - positionGrid.x ) * ( samplePositionGrid.x - positionGrid.x ) +
							( samplePositionGrid.y - positionGrid.y ) * ( samplePositionGrid.y - positionGrid.y ) +
							( samplePositionGrid.z - positionGrid.z ) * ( samplePositionGrid.z - positionGrid.z )
						);
						const positionInsideGrid = positionGrid.x >= - 0.001 && positionGrid.x <= 1.001 &&
							positionGrid.y >= - 0.001 && positionGrid.y <= 1.001 &&
							positionGrid.z >= - 0.001 && positionGrid.z <= 1.001;
						const sampleInsideGrid = samplePositionGrid.x >= - 0.001 && samplePositionGrid.x <= 1.001 &&
							samplePositionGrid.y >= - 0.001 && samplePositionGrid.y <= 1.001 &&
							samplePositionGrid.z >= - 0.001 && samplePositionGrid.z <= 1.001;

						return normalEncodedEnergy > 0.001 &&
							positionGridEnergy > 0.001 &&
							decodedNormalLength >= 0.85 &&
							decodedNormalLength <= 1.15 &&
							runtimeSampleBiasGridLength > 0.02 &&
							positionInsideGrid &&
							sampleInsideGrid;

					};
					const leftPixels = selectMaskedPixelSamples( maskData, 'left', isDebugReceiverPixel );
					const rightPixels = selectMaskedPixelSamples( maskData, 'right', isDebugReceiverPixel );
					const createSampleRows = async ( label, mesh, correctSide, pixels ) => {

						const rows = [];

						for ( const pixel of pixels ) {

							const sampleLabel = `gpu-visible-${ correctSide }-${ pixel.sampleOrder }`;
							const gpuPositionWorldGrid = getVector( 'positionWorldGrid', pixel );
							const gpuPositionWorld = grid01ToWorld( gpuPositionWorldGrid );
							const gpuDebugNormalEncoded = getVector( 'normalWorld', pixel );
							const gpuDebugNormal = decodeEncodedNormal( gpuDebugNormalEncoded );
							const gpuManualNormalEncoded = getVector( 'manualNormalWorld', pixel );
							const gpuManualNormal = decodeEncodedNormal( gpuManualNormalEncoded );
							const receiver = await analyzeReceiver(
								label,
								mesh,
								correctSide,
								currentVisibilityBiasScale,
								currentHitConfidencePolicy,
								{
									sampleKind: 'gpu-visible-receiver-pixel',
									sampleLabel,
									uv: {
										u: roundMetric( pixel.x / Math.max( width - 1, 1 ) ),
										v: roundMetric( pixel.y / Math.max( height - 1, 1 ) )
									},
									screenPixel: {
										x: pixel.x,
										y: pixel.y,
										readbackOrigin: 'render-target-readback'
									},
									worldPosition: gpuPositionWorld,
									worldNormal: new THREE.Vector3( gpuManualNormal.x, gpuManualNormal.y, gpuManualNormal.z ),
									quadratureWeight: 1,
									visibilityPath: gpuGuardedVisibilityActive ?
										'gpu-runtime-positionworld-distance-bias' :
										'gpu-runtime-unguarded-visibility',
									probeMetaPath: 'gpu-runtime-probe-meta'
								}
							);
							const contribution = await analyzeReceiverShContributions( receiver );
							const visibilityBlend = 1;
							const cpuScalarIrradiance = contribution.aggregates.scalar.irradiance;
							const cpuVisibilityIrradiance = contribution.aggregates.visibility.irradiance;
							const cpuFinalIrradiance = mixColorValue(
								cpuScalarIrradiance,
								cpuVisibilityIrradiance,
								receiver.totals.visibilityMass,
								visibilityBlend
							);
							const gpuSamplePositionGrid = getVector( 'samplePositionGrid', pixel );
							const gpuProbeCoordGrid = getVector( 'probeCoordGrid', pixel );
							const gpuBaseProbeCoordGrid = getVector( 'baseProbeCoordGrid', pixel );
							const gpuTrilinearBlend = getVector( 'trilinearBlend', pixel );
							const gpuScalarWeight = getScalar( 'scalarWeight', pixel );
							const gpuVisibilityWeight = getScalar( 'visibilityWeight', pixel );
							const gpuVisibilityMass = getScalar( 'visibilityMix', pixel );
							const gpuScalarIrradiance = getColor( 'scalarIrradiance', pixel );
							const gpuVisibilityIrradiance = getColor( 'visibilityIrradiance', pixel );
							const gpuFinalIrradiance = getColor( 'finalIrradiance', pixel );
							const cpuPositionWorldGrid = worldToGrid01( receiver.receiverPosition );
							const cpuSamplePositionGrid = worldToGrid01( receiver.samplePosition );
							const cpuNormalEncoded = normalToEncoded( receiver.receiverNormal );
							const cpuProbeCoordGrid = normalizeProbeCoord( receiver.probeCoord );
							const cpuBaseProbeCoordGrid = normalizeProbeCoord( receiver.baseProbeCoord );
							const neighborRows = receiver.rows.map( ( cpuRow, slot ) => {

								const gpuProbeIndexNormalized = getScalar( `neighbor${ slot }ProbeIndex`, pixel );
								const gpuProbeIndex = Math.round( gpuProbeIndexNormalized * totalProbeIndexScale );
								const gpuTrilinearWeight = getScalar( `neighbor${ slot }TrilinearWeight`, pixel );
								const gpuNormalWeight = getScalar( `neighbor${ slot }NormalWeight`, pixel );
								const gpuValidityWeight = getScalar( `neighbor${ slot }ValidityWeight`, pixel );
								const gpuConfidenceWeight = getScalar( `neighbor${ slot }ConfidenceWeight`, pixel );
								const gpuLayerCompatibility = getScalar( `neighbor${ slot }LayerCompatibility`, pixel );
								const gpuCompatibleKernel = getScalar( `neighbor${ slot }CompatibleKernel`, pixel );
								const gpuProbeDirectionEncoded = getVector( `neighbor${ slot }ProbeDirectionEncoded`, pixel );
								const gpuProbeDirection = decodeEncodedNormal( gpuProbeDirectionEncoded );
								const cpuProbeDirection = new THREE.Vector3(
									cpuRow.probePosition.x - receiver.receiverPosition.x,
									cpuRow.probePosition.y - receiver.receiverPosition.y,
									cpuRow.probePosition.z - receiver.receiverPosition.z
								).normalize();
								const cpuProbeDirectionEncoded = normalToEncoded( cpuProbeDirection );
								const gpuBaseWeight = getScalar( `neighbor${ slot }BaseWeight`, pixel );
								const gpuVisibility = getScalar( `neighbor${ slot }Visibility`, pixel );
								const gpuVisibilityWeight = getScalar( `neighbor${ slot }VisibilityWeight`, pixel );

								return {
									slot,
									cpuProbeIndex: cpuRow.probeIndex,
									gpuProbeIndex,
									probeIndexMatches: gpuProbeIndex === cpuRow.probeIndex,
									coord: cpuRow.coord,
									cpuTrilinearWeight: cpuRow.trilinearWeight,
									gpuTrilinearWeight,
									trilinearWeight: cpuRow.trilinearWeight,
									cpuNormalWeight: cpuRow.normalWeight,
									gpuNormalWeight,
									cpuValidityWeight: cpuRow.validityWeight,
									gpuValidityWeight,
									cpuConfidenceWeight: cpuRow.confidenceWeight,
									gpuConfidenceWeight,
									cpuLayerCompatibility: cpuRow.layerCompatibility,
									gpuLayerCompatibility,
									cpuCompatibleKernel: cpuRow.compatibleKernel,
									gpuCompatibleKernel,
									cpuProbeDirectionEncoded,
									gpuProbeDirectionEncoded,
									cpuProbeDirection: {
										x: roundMetric( cpuProbeDirection.x ),
										y: roundMetric( cpuProbeDirection.y ),
										z: roundMetric( cpuProbeDirection.z )
									},
									gpuProbeDirection,
									cpuScalarWeight: cpuRow.scalarWeight,
									cpuBaseWeight: cpuRow.baseWeight,
									cpuVisibility: cpuRow.visibility,
									cpuVisibilityWeight: cpuRow.visibilityWeight,
									gpuBaseWeight,
									gpuVisibility,
									gpuVisibilityWeight,
									trilinearWeightDelta: roundMetric( Math.abs( gpuTrilinearWeight - cpuRow.trilinearWeight ) ),
									normalWeightDelta: roundMetric( Math.abs( gpuNormalWeight - cpuRow.normalWeight ) ),
									validityWeightDelta: roundMetric( Math.abs( gpuValidityWeight - cpuRow.validityWeight ) ),
									confidenceWeightDelta: roundMetric( Math.abs( gpuConfidenceWeight - cpuRow.confidenceWeight ) ),
									layerCompatibilityDelta: roundMetric( Math.abs( gpuLayerCompatibility - cpuRow.layerCompatibility ) ),
									compatibleKernelDelta: roundMetric( Math.abs( gpuCompatibleKernel - cpuRow.compatibleKernel ) ),
									probeDirectionEncodedDelta: vectorDelta( gpuProbeDirectionEncoded, cpuProbeDirectionEncoded ),
									baseWeightDelta: roundMetric( Math.abs( gpuBaseWeight - cpuRow.baseWeight ) ),
									visibilityDelta: roundMetric( Math.abs( gpuVisibility - cpuRow.visibility ) ),
									visibilityWeightDelta: roundMetric( Math.abs( gpuVisibilityWeight - cpuRow.visibilityWeight ) )
								};

							} );
							const irradianceTerms = [
								{
									label: 'scalarIrradiance',
									cpuLinearRgb: cpuScalarIrradiance,
									gpuLinearRgb: gpuScalarIrradiance,
									delta: createLinearColorDelta( gpuScalarIrradiance, cpuScalarIrradiance )
								},
								{
									label: 'visibilityIrradiance',
									cpuLinearRgb: cpuVisibilityIrradiance,
									gpuLinearRgb: gpuVisibilityIrradiance,
									delta: createLinearColorDelta( gpuVisibilityIrradiance, cpuVisibilityIrradiance )
								},
								{
									label: 'finalIrradiance',
									cpuLinearRgb: cpuFinalIrradiance,
									gpuLinearRgb: gpuFinalIrradiance,
									delta: createLinearColorDelta( gpuFinalIrradiance, cpuFinalIrradiance )
								}
							];

							rows.push( {
								receiver: label,
								correctSide,
								sampleKind: receiver.sampleKind,
								sampleLabel,
								screen: {
									pixelX: pixel.x,
									pixelY: pixel.y,
									readbackPixelIndex: pixel.pixelIndex,
									readbackOrigin: 'render-target-readback'
								},
								cpu: {
									positionWorld: receiver.receiverPosition,
									positionWorldGrid: cpuPositionWorldGrid,
									samplePositionWorld: receiver.samplePosition,
									samplePositionGrid: cpuSamplePositionGrid,
									normalWorld: receiver.receiverNormal,
									normalEncoded: cpuNormalEncoded,
									probeCoord: receiver.probeCoord,
									probeCoordGrid: cpuProbeCoordGrid,
									baseProbeCoord: receiver.baseProbeCoord,
									baseProbeCoordGrid: cpuBaseProbeCoordGrid,
									trilinearBlend: receiver.trilinearBlend,
									selectedProbeIndices: receiver.selectedProbeIndices,
									scalarWeight: receiver.totals.baseSum,
									baseWeight: receiver.totals.baseSum,
									visibilityWeight: receiver.totals.visibleSum,
									visibilityMass: receiver.totals.visibilityMass,
									visibilityPath: receiver.runtimeVisibilityPath,
									probeMetaPath: receiver.probeMetaPath,
									normalSource: receiver.normalSource,
									visibilityDistanceBias: receiver.visibilityDistanceBias,
									legacyRuntimeFinalIrradiance: contribution.aggregates.runtimeFinal.irradiance
								},
								gpu: {
									positionWorld: roundWorldVector( gpuPositionWorld ),
									positionWorldGrid: gpuPositionWorldGrid,
									samplePositionGrid: gpuSamplePositionGrid,
									normalEncoded: gpuManualNormalEncoded,
									normalWorld: gpuManualNormal,
									manualNormalEncoded: gpuManualNormalEncoded,
									manualNormalWorld: gpuManualNormal,
									debugNormalEncoded: gpuDebugNormalEncoded,
									debugNormalWorld: gpuDebugNormal,
									probeCoordGrid: gpuProbeCoordGrid,
									baseProbeCoordGrid: gpuBaseProbeCoordGrid,
									trilinearBlend: gpuTrilinearBlend,
									selectedProbeIndices: neighborRows.map( row => row.gpuProbeIndex ),
									scalarWeight: gpuScalarWeight,
									baseWeight: gpuScalarWeight,
									visibilityWeight: gpuVisibilityWeight,
									visibilityMass: gpuVisibilityMass
								},
								deltas: {
									positionWorldGrid: vectorDelta( gpuPositionWorldGrid, cpuPositionWorldGrid ),
									samplePositionGrid: vectorDelta( gpuSamplePositionGrid, cpuSamplePositionGrid ),
									normalEncoded: vectorDelta( gpuManualNormalEncoded, cpuNormalEncoded ),
									debugNormalToManualEncoded: vectorDelta( gpuDebugNormalEncoded, gpuManualNormalEncoded ),
									probeCoordGrid: vectorDelta( gpuProbeCoordGrid, cpuProbeCoordGrid ),
									baseProbeCoordGrid: vectorDelta( gpuBaseProbeCoordGrid, cpuBaseProbeCoordGrid ),
									trilinearBlend: vectorDelta( gpuTrilinearBlend, receiver.trilinearBlend ),
									scalarWeight: roundMetric( Math.abs( gpuScalarWeight - receiver.totals.baseSum ) ),
									visibilityWeight: roundMetric( Math.abs( gpuVisibilityWeight - receiver.totals.visibleSum ) ),
									visibilityMass: roundMetric( Math.abs( gpuVisibilityMass - receiver.totals.visibilityMass ) )
								},
								neighborRows,
								irradianceTerms
							} );

						}

						return rows;

					};
					const samples = [
						...await createSampleRows( 'leftReceiver', _lightProbeContext.leakFixture.leftReceiver, 'left', leftPixels ),
						...await createSampleRows( 'rightReceiver', _lightProbeContext.leakFixture.rightReceiver, 'right', rightPixels )
					];
					const finalColor = ( sample, source ) =>
						sample.irradianceTerms.find( term => term.label === 'finalIrradiance' )[ source === 'cpu' ? 'cpuLinearRgb' : 'gpuLinearRgb' ];
					const summarizeReceiverSamples = ( rows, correctSide ) => {

						const cpuColor = divideColor(
							rows.reduce( ( total, sample ) => addWeightedColor( total, finalColor( sample, 'cpu' ), 1 ), { r: 0, g: 0, b: 0 } ),
							Math.max( rows.length, 1 )
						);
						const gpuColor = divideColor(
							rows.reduce( ( total, sample ) => addWeightedColor( total, finalColor( sample, 'gpu' ), 1 ), { r: 0, g: 0, b: 0 } ),
							Math.max( rows.length, 1 )
						);
						const cpuWrong = correctSide === 'left' ?
							cpuColor.g / Math.max( cpuColor.r, 0.0001 ) :
							cpuColor.r / Math.max( cpuColor.g, 0.0001 );
						const gpuWrong = correctSide === 'left' ?
							gpuColor.g / Math.max( gpuColor.r, 0.0001 ) :
							gpuColor.r / Math.max( gpuColor.g, 0.0001 );

						return {
							sampleCount: rows.length,
							cpuFinalIrradianceMean: cpuColor,
							gpuFinalIrradianceMean: gpuColor,
							cpuWrongOverCorrect: roundMetric( cpuWrong ),
							gpuWrongOverCorrect: roundMetric( gpuWrong ),
							wrongOverCorrectDelta: roundMetric( Math.abs( gpuWrong - cpuWrong ) )
						};

					};
					const leftSummary = summarizeReceiverSamples( samples.filter( sample => sample.correctSide === 'left' ), 'left' );
					const rightSummary = summarizeReceiverSamples( samples.filter( sample => sample.correctSide === 'right' ), 'right' );
					const finiteVectorDeltaMax = key => Math.max(
						0,
						...samples.map( sample => sample.deltas[ key ]?.max ?? 0 ).filter( Number.isFinite )
					);
					const finiteScalarDeltaMax = key => Math.max(
						0,
						...samples.map( sample => sample.deltas[ key ] ?? 0 ).filter( Number.isFinite )
					);
					const maxNeighborDelta = key => Math.max(
						0,
						...samples.flatMap( sample => sample.neighborRows.map( row => row[ key ] ?? 0 ) ).filter( Number.isFinite )
					);
					const maxNeighborVectorDelta = key => Math.max(
						0,
						...samples.flatMap( sample => sample.neighborRows.map( row => row[ key ]?.max ?? 0 ) ).filter( Number.isFinite )
					);
					const maxNeighborComponentDeltas = {
						trilinearWeight: maxNeighborDelta( 'trilinearWeightDelta' ),
						probeDirection: maxNeighborVectorDelta( 'probeDirectionEncodedDelta' ),
						normalWeight: maxNeighborDelta( 'normalWeightDelta' ),
						validityWeight: maxNeighborDelta( 'validityWeightDelta' ),
						confidenceWeight: maxNeighborDelta( 'confidenceWeightDelta' ),
						layerCompatibility: maxNeighborDelta( 'layerCompatibilityDelta' ),
						compatibleKernel: maxNeighborDelta( 'compatibleKernelDelta' ),
						baseWeight: maxNeighborDelta( 'baseWeightDelta' ),
						visibility: maxNeighborDelta( 'visibilityDelta' ),
						visibilityWeight: maxNeighborDelta( 'visibilityWeightDelta' )
					};
					const dominantWeightingMismatchComponent = Object.entries( maxNeighborComponentDeltas )
						.sort( ( a, b ) => b[ 1 ] - a[ 1 ] )[ 0 ]?.[ 0 ] ?? 'none';
					const maxIrradianceDelta = Math.max(
						0,
						...samples.flatMap( sample => sample.irradianceTerms.map( term => term.delta?.max ?? 0 ) ).filter( Number.isFinite )
					);
					const finalIrradianceDeltaMax = Math.max(
						0,
						...samples.map( sample => sample.irradianceTerms.find( term => term.label === 'finalIrradiance' )?.delta?.max ?? 0 ).filter( Number.isFinite )
					);
					const finalIrradianceDeltaMean = roundMetric(
						samples.reduce( ( total, sample ) =>
							total + ( sample.irradianceTerms.find( term => term.label === 'finalIrradiance' )?.delta?.mean ?? 0 ), 0
						) / Math.max( samples.length, 1 )
					);
					const selectedProbeMismatchCount = samples.reduce(
						( total, sample ) => total + sample.neighborRows.filter( row => row.probeIndexMatches === false ).length,
						0
					);
					const cpuWrongSideRatioMean = roundMetric( ( leftSummary.cpuWrongOverCorrect + rightSummary.cpuWrongOverCorrect ) * 0.5 );
					const gpuWrongSideRatioMean = roundMetric( ( leftSummary.gpuWrongOverCorrect + rightSummary.gpuWrongOverCorrect ) * 0.5 );
					const cpuWrongSideRatioMax = roundMetric( Math.max( leftSummary.cpuWrongOverCorrect, rightSummary.cpuWrongOverCorrect ) );
					const gpuWrongSideRatioMax = roundMetric( Math.max( leftSummary.gpuWrongOverCorrect, rightSummary.gpuWrongOverCorrect ) );
					const cpuGpuWrongSideRatioDeltaMean = roundMetric( Math.abs( gpuWrongSideRatioMean - cpuWrongSideRatioMean ) );
					const cpuGpuWrongSideRatioDeltaMax = roundMetric( Math.abs( gpuWrongSideRatioMax - cpuWrongSideRatioMax ) );
					const fullMaskCpuDeltaMean = runtimeProbeRow?.maskedWrongSideColorRatio === undefined ? null :
						roundMetric( Math.abs( runtimeProbeRow.maskedWrongSideColorRatio - cpuWrongSideRatioMean ) );
					const fullMaskCpuDeltaMax = runtimeProbeRow?.maskedWrongSideColorRatio === undefined ? null :
						roundMetric( Math.abs( runtimeProbeRow.maskedWrongSideColorRatio - cpuWrongSideRatioMax ) );
					const thresholds = {
						positionGridMax: 0.02,
						normalEncodedMax: 0.03,
						probeCoordGridMax: 0.02,
						weightMax: 0.15,
						irradianceMax: 0.08,
						wrongSideRatioMax: 0.15
					};
					const positionSupported = finiteVectorDeltaMax( 'positionWorldGrid' ) <= thresholds.positionGridMax &&
						finiteVectorDeltaMax( 'samplePositionGrid' ) <= thresholds.positionGridMax;
					const normalSupported = finiteVectorDeltaMax( 'normalEncoded' ) <= thresholds.normalEncodedMax;
					const probeCoordSupported = finiteVectorDeltaMax( 'probeCoordGrid' ) <= thresholds.probeCoordGridMax &&
						finiteVectorDeltaMax( 'baseProbeCoordGrid' ) <= thresholds.probeCoordGridMax &&
						finiteVectorDeltaMax( 'trilinearBlend' ) <= thresholds.probeCoordGridMax &&
						selectedProbeMismatchCount === 0;
					const weightingSupported = finiteScalarDeltaMax( 'scalarWeight' ) <= thresholds.weightMax &&
						finiteScalarDeltaMax( 'visibilityWeight' ) <= thresholds.weightMax &&
						finiteScalarDeltaMax( 'visibilityMass' ) <= thresholds.weightMax &&
						maxNeighborComponentDeltas.trilinearWeight <= thresholds.weightMax &&
						maxNeighborComponentDeltas.probeDirection <= thresholds.normalEncodedMax &&
						maxNeighborComponentDeltas.normalWeight <= thresholds.weightMax &&
						maxNeighborComponentDeltas.validityWeight <= thresholds.weightMax &&
						maxNeighborComponentDeltas.confidenceWeight <= thresholds.weightMax &&
						maxNeighborComponentDeltas.layerCompatibility <= thresholds.weightMax &&
						maxNeighborComponentDeltas.compatibleKernel <= thresholds.weightMax &&
						maxNeighborDelta( 'baseWeightDelta' ) <= thresholds.weightMax &&
						maxNeighborDelta( 'visibilityWeightDelta' ) <= thresholds.weightMax;
					const shSupported = maxIrradianceDelta <= thresholds.irradianceMax &&
						finalIrradianceDeltaMax <= thresholds.irradianceMax;
					const sampledWrongSideRatioSupported = cpuGpuWrongSideRatioDeltaMean <= thresholds.wrongSideRatioMax ||
						cpuGpuWrongSideRatioDeltaMax <= thresholds.wrongSideRatioMax;
					const exactPixelAgreementSupported = samples.length > 0 &&
						positionSupported &&
						normalSupported &&
						probeCoordSupported &&
						weightingSupported &&
						shSupported &&
						sampledWrongSideRatioSupported;
					const dominantMismatchSource = samples.length === 0 ?
						'visible-receiver-mask-samples-missing' :
						positionSupported === false ? 'cpu-vs-gpu-sample-position-mismatch' :
							normalSupported === false ? 'cpu-vs-gpu-normal-convention-mismatch' :
								probeCoordSupported === false ? 'cpu-vs-gpu-probe-coordinate-or-blend-mismatch' :
									weightingSupported === false ? 'cpu-vs-gpu-weighting-mismatch' :
										shSupported === false ? 'cpu-vs-gpu-sh-evaluation-mismatch' :
											sampledWrongSideRatioSupported === false ? 'visible-pixel-ratio-aggregation-mismatch' :
												'none-within-visible-pixel-thresholds';

					return {
						status: exactPixelAgreementSupported ?
							'SUPPORTED-VISIBLE-PIXEL-CPU-GPU-SCENE-LINEAR-PARITY' :
							'OPEN-VISIBLE-PIXEL-CPU-GPU-SCENE-LINEAR-MISMATCH',
						mode: 'gpu-read-visible-receiver-pixel-position-cpu-mirror',
						proofBoundary: 'Proof-only exact visible receiver pixel CPU mirror; CPU samples are seeded from GPU-read positionWorldGrid at depth-preserved receiver-mask pixels and compare private debug rows without changing runtime constants, moments, Chebyshev thresholds, or public API.',
						maskOcclusionPolicy: 'depth-preserved-full-scene-mask',
						gpuGuardedVisibilityActive,
						size: { width, height },
						maxSamplesPerReceiver,
						thresholds,
						leftReceiver: leftSummary,
						rightReceiver: rightSummary,
						summary: {
							sampleCount: samples.length,
							leftSampleCount: leftSummary.sampleCount,
							rightSampleCount: rightSummary.sampleCount,
							gpuGuardedVisibilityActive,
							positionSupported,
							normalSupported,
							probeCoordSupported,
							weightingSupported,
							shSupported,
							sampledWrongSideRatioSupported,
							exactPixelAgreementSupported,
							dominantMismatchSource,
							maxPositionGridDelta: finiteVectorDeltaMax( 'positionWorldGrid' ),
							maxSamplePositionGridDelta: finiteVectorDeltaMax( 'samplePositionGrid' ),
							maxNormalEncodedDelta: finiteVectorDeltaMax( 'normalEncoded' ),
							maxProbeCoordGridDelta: finiteVectorDeltaMax( 'probeCoordGrid' ),
							maxBaseProbeCoordGridDelta: finiteVectorDeltaMax( 'baseProbeCoordGrid' ),
							maxTrilinearBlendDelta: finiteVectorDeltaMax( 'trilinearBlend' ),
							selectedProbeMismatchCount,
							maxScalarWeightDelta: finiteScalarDeltaMax( 'scalarWeight' ),
							maxVisibilityWeightDelta: finiteScalarDeltaMax( 'visibilityWeight' ),
							maxVisibilityMassDelta: finiteScalarDeltaMax( 'visibilityMass' ),
							dominantWeightingMismatchComponent,
							maxNeighborWeightComponentDeltas: maxNeighborComponentDeltas,
							maxNeighborTrilinearWeightDelta: maxNeighborComponentDeltas.trilinearWeight,
							maxNeighborProbeDirectionEncodedDelta: maxNeighborComponentDeltas.probeDirection,
							maxNeighborNormalWeightDelta: maxNeighborComponentDeltas.normalWeight,
							maxNeighborValidityWeightDelta: maxNeighborComponentDeltas.validityWeight,
							maxNeighborConfidenceWeightDelta: maxNeighborComponentDeltas.confidenceWeight,
							maxNeighborLayerCompatibilityDelta: maxNeighborComponentDeltas.layerCompatibility,
							maxNeighborCompatibleKernelDelta: maxNeighborComponentDeltas.compatibleKernel,
							maxNeighborBaseWeightDelta: maxNeighborDelta( 'baseWeightDelta' ),
							maxNeighborVisibilityWeightDelta: maxNeighborDelta( 'visibilityWeightDelta' ),
							maxLinearIrradianceDelta: maxIrradianceDelta,
							finalIrradianceDeltaMean,
							finalIrradianceDeltaMax,
							cpuSampledWrongSideRatioMean: cpuWrongSideRatioMean,
							cpuSampledWrongSideRatioMax: cpuWrongSideRatioMax,
							gpuSampledWrongSideRatioMean: gpuWrongSideRatioMean,
							gpuSampledWrongSideRatioMax: gpuWrongSideRatioMax,
							cpuGpuWrongSideRatioDeltaMean,
							cpuGpuWrongSideRatioDeltaMax,
							fullMaskRuntimeProbeWrongSideRatio: runtimeProbeRow?.maskedWrongSideColorRatio ?? null,
							fullMaskCpuSampledDeltaMean: fullMaskCpuDeltaMean,
							fullMaskCpuSampledDeltaMax: fullMaskCpuDeltaMax,
							diagnosticConclusion: exactPixelAgreementSupported ?
								'CPU and GPU agree for the exact sampled visible receiver pixels when the CPU mirror is seeded from GPU-read positions and mirrors the runtime probe meta / visibility-distance path; projected surface quadrature is not a valid scene-linear aggregate proxy.' :
								`At least one exact visible-pixel CPU/GPU parity axis remains outside threshold; keep final scene-linear promotion open and use dominantMismatchSource${ weightingSupported === false ? ` / dominantWeightingMismatchComponent=${ dominantWeightingMismatchComponent }` : '' } to patch the verifier/debug path before tuning visibility.`
						},
						samples
					};

				} catch ( error ) {

					return {
						status: 'OPEN-VISIBLE-PIXEL-CPU-GPU-SCENE-LINEAR-READBACK-FAILED',
						mode: 'gpu-read-visible-receiver-pixel-position-cpu-mirror',
						proofBoundary: 'Proof-only exact visible receiver pixel CPU mirror failed before producing comparable rows; keep final scene-linear promotion open.',
						error: error?.message ?? `${ error }`,
						summary: {
							sampleCount: 0,
							exactPixelAgreementSupported: false,
							dominantMismatchSource: 'visible-pixel-debug-readback-failed',
							diagnosticConclusion: 'Exact visible-pixel CPU mirror readback failed; keep final scene-linear promotion open.'
						},
						samples: []
					};

				} finally {

					restoreReceiverReadbackState( previousState );
					leftMaskMaterial.dispose();
					rightMaskMaterial.dispose();
					occluderMaskMaterial.dispose();
					debugTarget.dispose();
					maskTarget.dispose();
					_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				}

			};

			const captureOffscreenSceneLinearTarget = async ( options = {} ) => {

				const width = _lightProbeContext.renderer.domElement.width;
				const height = _lightProbeContext.renderer.domElement.height;
				const label = options.label ?? 'current-lighting';
				const receiverAlbedoMode = options.receiverAlbedoMode ?? 'original-receiver-albedo';
				const previousState = createReceiverReadbackStateSnapshot();
				const receiverMaterial = options.receiverMaterial ?? null;
				const overrideLeftMaterial = receiverMaterial === null && options.receiverAlbedo !== undefined ? previousState.leftMaterial.clone() : null;
				const overrideRightMaterial = receiverMaterial === null && options.receiverAlbedo !== undefined ? previousState.rightMaterial.clone() : null;
				const selectedLighting = {
					directIntensity: options.directIntensity ?? previousState.directLightIntensity,
					ambientIntensity: options.ambientIntensity ?? previousState.ambientLightIntensity,
					probeIntensity: options.probeIntensity ?? previousState.probeIntensity
				};
				const colorTarget = new THREE.RenderTarget( width, height, {
					type: THREE.HalfFloatType,
					colorSpace: THREE.LinearSRGBColorSpace,
					depthBuffer: true,
					stencilBuffer: false,
					samples: 0
				} );
				const maskTarget = new THREE.RenderTarget( width, height, {
					type: THREE.UnsignedByteType,
					colorSpace: THREE.NoColorSpace,
					depthBuffer: true,
					stencilBuffer: false,
					samples: 0
				} );
				const leftMaskMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, toneMapped: false } );
				const rightMaskMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00, toneMapped: false } );
				const occluderMaskMaterial = new THREE.MeshBasicMaterial( { color: 0x000000, toneMapped: false } );
				const captureReceiverOnlyMaskData = async () => {

					return await captureSceneMeshOverrides( object => {
						object.visible = object === _lightProbeContext.leakFixture.leftReceiver ||
							object === _lightProbeContext.leakFixture.rightReceiver;

						if ( object === _lightProbeContext.leakFixture.leftReceiver ) {

							object.material = leftMaskMaterial;

						} else if ( object === _lightProbeContext.leakFixture.rightReceiver ) {

							object.material = rightMaskMaterial;

						}
					}, async () => {

						_lightProbeContext.scene.background = new THREE.Color( 0x000000 );
						_lightProbeContext.leakFixture.leftReceiver.visible = true;
						_lightProbeContext.leakFixture.rightReceiver.visible = true;
						return await readLightProbeGridGPURenderedTargetRegion(
							_lightProbeContext.renderer,
							_lightProbeContext.scene,
							_lightProbeContext.camera,
							maskTarget,
							width,
							height
						);
					} );

				};

				if ( overrideLeftMaterial !== null && overrideLeftMaterial.color !== undefined ) {

					overrideLeftMaterial.color.set( options.receiverAlbedo );
					overrideRightMaterial.color.set( options.receiverAlbedo );

				}

				try {

					_lightProbeContext.renderer.toneMapping = THREE.NoToneMapping;
					_lightProbeContext.renderer.toneMappingExposure = 1;
					_lightProbeContext.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
					_lightProbeContext.probeGrid.visibilityDepthWeighting.value = 1;
					_lightProbeContext.directLight.intensity = selectedLighting.directIntensity;
					_lightProbeContext.ambientLight.intensity = selectedLighting.ambientIntensity;
					_lightProbeContext.probeGrid.probeIntensity.value = selectedLighting.probeIntensity;
					if ( receiverMaterial !== null ) {

						_lightProbeContext.leakFixture.leftReceiver.material = receiverMaterial;
						_lightProbeContext.leakFixture.rightReceiver.material = receiverMaterial;

					} else if ( overrideLeftMaterial !== null ) {

						_lightProbeContext.leakFixture.leftReceiver.material = overrideLeftMaterial;
						_lightProbeContext.leakFixture.rightReceiver.material = overrideRightMaterial;

					}

					const colorData = await readLightProbeGridGPURenderedTargetRegion(
						_lightProbeContext.renderer,
						_lightProbeContext.scene,
						_lightProbeContext.camera,
						colorTarget,
						width,
						height
					);
					const maskData = await captureDepthPreservedReceiverMaskData( {
						width,
						height,
						maskTarget,
						leftMaskMaterial,
						rightMaskMaterial,
						occluderMaskMaterial
					} );
					const legacyReceiverOnlyMaskData = await captureReceiverOnlyMaskData();
					const left = createReadbackReceiverMetric( colorData, maskData, width, height, THREE.HalfFloatType, 'left' );
					const right = createReadbackReceiverMetric( colorData, maskData, width, height, THREE.HalfFloatType, 'right' );
					const legacyLeft = createReadbackReceiverMetric( colorData, legacyReceiverOnlyMaskData, width, height, THREE.HalfFloatType, 'left' );
					const legacyRight = createReadbackReceiverMetric( colorData, legacyReceiverOnlyMaskData, width, height, THREE.HalfFloatType, 'right' );
					const maskedWrongSideColorRatio = Math.max(
						left.colorBias.greenOverRed,
						right.colorBias.redOverGreen
					);
					const maskedCorrectBounceRatio = Math.min(
						left.colorBias.redOverGreen,
						right.colorBias.greenOverRed
					);
					const legacyMaskedWrongSideColorRatio = Math.max(
						legacyLeft.colorBias.greenOverRed,
						legacyRight.colorBias.redOverGreen
					);
					const legacyMaskedCorrectBounceRatio = Math.min(
						legacyLeft.colorBias.redOverGreen,
						legacyRight.colorBias.greenOverRed
					);
					const chromaticityWrongSidePressure = Math.max(
						left.chromaticity.g - left.chromaticity.r,
						right.chromaticity.r - right.chromaticity.g
					);
					const maxChannelWrongOverCorrect = Math.max(
						left.maxChannel / Math.max( right.maxChannel, 0.0001 ),
						right.maxChannel / Math.max( left.maxChannel, 0.0001 )
					);
					const rgbChannelWrongOverCorrect = {
						leftWrongGreenOverCorrectRed: roundMetric( left.color.g / Math.max( left.color.r, 0.0001 ) ),
						rightWrongRedOverCorrectGreen: roundMetric( right.color.r / Math.max( right.color.g, 0.0001 ) ),
						blueLeftOverRight: roundMetric( left.color.b / Math.max( right.color.b, 0.0001 ) ),
						blueRightOverLeft: roundMetric( right.color.b / Math.max( left.color.b, 0.0001 ) )
					};

					return {
						status: left.samples > 0 && right.samples > 0 ? 'SUPPORTED' : 'OPEN-NO-MASK-SAMPLES',
						label,
						mode: 'offscreen-half-float-linear-target',
						type: 'HalfFloatType',
						toneMapping: 'NoToneMapping',
						outputColorSpace: THREE.LinearSRGBColorSpace,
						receiverAlbedoMode,
						receiverMaterialMode: receiverMaterial === null ? 'runtime-standard-receiver-material' : options.receiverMaterialMode ?? 'debug-receiver-material',
						lighting: {
							directIntensity: roundMetric( selectedLighting.directIntensity ),
							ambientIntensity: roundMetric( selectedLighting.ambientIntensity ),
							probeIntensity: roundMetric( selectedLighting.probeIntensity )
						},
						size: { width, height },
						leftReceiverMasked: left,
						rightReceiverMasked: right,
						maskOcclusionPolicy: 'depth-preserved-full-scene-mask',
						legacyReceiverOnlyMaskDiagnostic: {
							mode: 'legacy-receiver-only-mask-without-scene-occluders',
							leftReceiverMasked: legacyLeft,
							rightReceiverMasked: legacyRight,
							maskedWrongSideColorRatio: roundMetric( legacyMaskedWrongSideColorRatio ),
							maskedCorrectBounceRatio: roundMetric( legacyMaskedCorrectBounceRatio ),
							extraLeftSamples: legacyLeft.samples - left.samples,
							extraRightSamples: legacyRight.samples - right.samples,
							wrongSideRatioDelta: roundMetric( Math.abs( legacyMaskedWrongSideColorRatio - maskedWrongSideColorRatio ) ),
							diagnosticConclusion: 'The legacy receiver-only mask hides scene occluders during mask capture; the depth-preserved mask keeps non-receiver depth so color and mask pixels refer to the same visible receiver fragments.'
						},
						maskedWrongSideColorRatio: roundMetric( maskedWrongSideColorRatio ),
						maskedCorrectBounceRatio: roundMetric( maskedCorrectBounceRatio ),
						luminanceWrongOverCorrect: roundMetric(
							Math.max( left.luminance.mean / Math.max( right.luminance.mean, 0.0001 ), right.luminance.mean / Math.max( left.luminance.mean, 0.0001 ) )
						),
						energyWrongOverCorrect: roundMetric(
							Math.max( left.energy / Math.max( right.energy, 0.0001 ), right.energy / Math.max( left.energy, 0.0001 ) )
						),
						maxChannelWrongOverCorrect: roundMetric( maxChannelWrongOverCorrect ),
						chromaticityWrongSidePressure: roundMetric( chromaticityWrongSidePressure ),
						rgbChannelWrongOverCorrect
					};

				} catch ( error ) {

					return {
						status: 'OPEN-OFFSCREEN-LINEAR-TARGET-READBACK-FAILED',
						label,
						mode: 'offscreen-half-float-linear-target',
						type: 'HalfFloatType',
						receiverAlbedoMode,
						lighting: {
							directIntensity: roundMetric( selectedLighting.directIntensity ),
							ambientIntensity: roundMetric( selectedLighting.ambientIntensity ),
							probeIntensity: roundMetric( selectedLighting.probeIntensity )
						},
						error: error?.message ?? `${ error }`
					};

				} finally {

					restoreReceiverReadbackState( previousState );
					leftMaskMaterial.dispose();
					rightMaskMaterial.dispose();
					occluderMaskMaterial.dispose();
					if ( overrideLeftMaterial !== null ) overrideLeftMaterial.dispose();
					if ( overrideRightMaterial !== null ) overrideRightMaterial.dispose();
					colorTarget.dispose();
					maskTarget.dispose();
					_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				}

			};

			const capture = ( label, options = {} ) => {

				_lightProbeContext.probeGrid.visibilityDepthWeighting.value = options.visibilityDepthWeighting ?? currentVisibilityWeighting;
				_lightProbeContext.renderer.toneMapping = options.toneMapping ?? currentToneMapping;
				_lightProbeContext.renderer.toneMappingExposure = options.toneMappingExposure ?? currentToneMappingExposure;
				_lightProbeContext.renderer.outputColorSpace = options.outputColorSpace ?? currentOutputColorSpace;
				_lightProbeContext.leakFixture.leftReceiver.material = options.material ?? currentLeftMaterial;
				_lightProbeContext.leakFixture.rightReceiver.material = options.material ?? currentRightMaterial;
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				return {
					label,
					material: options.materialLabel ?? 'original receiver material',
					probeVisibilityDepthWeighting: _lightProbeContext.probeGrid.visibilityDepthWeighting.value,
					toneMapping: toneMappingName( _lightProbeContext.renderer.toneMapping ),
					toneMappingExposure: _lightProbeContext.renderer.toneMappingExposure,
					outputColorSpace: colorSpaceName( _lightProbeContext.renderer.outputColorSpace ),
					leakMetrics: createMetricSummary( captureLeakRegionMetrics() ),
					pointMetrics: createTightSurfacePointMetrics( captureCanvasSample() )
				};

			};

			try {

				const standardCurrent = capture( 'standard-material-current-renderer', {
					materialLabel: 'MeshStandardNodeMaterial lightsNode = directLight + ambientLight + IrradianceNode; current renderer tone mapping'
				} );
				const standardAcesExposureHalf = capture( 'standard-material-aces-exposure-0.5', {
					materialLabel: 'MeshStandardNodeMaterial lightsNode = directLight + ambientLight + IrradianceNode; ACES exposure 0.5',
					toneMapping: THREE.ACESFilmicToneMapping,
					toneMappingExposure: 0.5
				} );
				const standardAcesExposureDouble = capture( 'standard-material-aces-exposure-2.0', {
					materialLabel: 'MeshStandardNodeMaterial lightsNode = directLight + ambientLight + IrradianceNode; ACES exposure 2.0',
					toneMapping: THREE.ACESFilmicToneMapping,
					toneMappingExposure: 2.0
				} );
				const standardNoToneMapping = capture( 'standard-material-no-tone-mapping', {
					materialLabel: 'MeshStandardNodeMaterial lightsNode = directLight + ambientLight + IrradianceNode; renderer NoToneMapping',
					toneMapping: THREE.NoToneMapping
				} );
				const standardLinearOutput = capture( 'standard-material-linear-output-no-tone-mapping', {
					materialLabel: 'MeshStandardNodeMaterial lightsNode = directLight + ambientLight + IrradianceNode; renderer NoToneMapping + LinearSRGBColorSpace',
					toneMapping: THREE.NoToneMapping,
					outputColorSpace: THREE.LinearSRGBColorSpace
				} );
				const debugFinalIrradiance = capture( 'meshbasic-final-irradiance-linear-debug', {
					material: debugMaterial,
					materialLabel: 'MeshBasicNodeMaterial colorNode = private finalIrradiance * 0.25; toneMapped=false',
					toneMapping: THREE.NoToneMapping,
					visibilityDepthWeighting: 1
				} );
				const debugLambert = capture( 'meshbasic-final-lambert-debug', {
					material: lambertDebugMaterial,
					materialLabel: 'MeshBasicNodeMaterial colorNode = private finalIrradiance * receiverLinearDiffuse / PI; toneMapped=false',
					toneMapping: THREE.NoToneMapping,
					outputColorSpace: THREE.LinearSRGBColorSpace,
					visibilityDepthWeighting: 1
				} );
				const offscreenSceneLinearTarget = await captureOffscreenSceneLinearTarget( {
					label: 'current-lighting'
				} );
				const captureContributionRows = async ( options = {} ) => [
					await captureOffscreenSceneLinearTarget( {
						label: `${ options.labelPrefix ?? '' }runtime-probe-indirect-scene-linear`,
						directIntensity: 0,
						ambientIntensity: 0,
						probeIntensity: _lightProbeContext.params.probeIntensity,
						receiverAlbedoMode: options.receiverAlbedoMode,
						receiverAlbedo: options.receiverAlbedo,
						receiverMaterial: runtimeProbeIndirectMaterial,
						receiverMaterialMode: 'meshbasic-private-finalIrradiance-no-albedo'
					} ),
					await captureOffscreenSceneLinearTarget( {
						label: `${ options.labelPrefix ?? '' }probe-indirect-after-albedo`,
						directIntensity: 0,
						ambientIntensity: 0,
						probeIntensity: _lightProbeContext.params.probeIntensity,
						receiverAlbedoMode: options.receiverAlbedoMode,
						receiverAlbedo: options.receiverAlbedo,
						receiverMaterial: albedoDebugMaterial,
						receiverMaterialMode: 'meshbasic-private-finalIrradiance-times-receiver-albedo'
					} ),
					await captureOffscreenSceneLinearTarget( {
						label: `${ options.labelPrefix ?? '' }probe-indirect-lambert-bsdf`,
						directIntensity: 0,
						ambientIntensity: 0,
						probeIntensity: _lightProbeContext.params.probeIntensity,
						receiverAlbedoMode: options.receiverAlbedoMode,
						receiverAlbedo: options.receiverAlbedo,
						receiverMaterial: lambertDebugMaterial,
						receiverMaterialMode: 'meshbasic-private-finalIrradiance-times-receiver-albedo-over-pi'
					} ),
					await captureOffscreenSceneLinearTarget( {
						label: `${ options.labelPrefix ?? '' }probes-only`,
						directIntensity: 0,
						ambientIntensity: 0,
						probeIntensity: _lightProbeContext.params.probeIntensity,
						receiverAlbedoMode: options.receiverAlbedoMode,
						receiverAlbedo: options.receiverAlbedo
					} ),
					await captureOffscreenSceneLinearTarget( {
						label: `${ options.labelPrefix ?? '' }direct-only`,
						directIntensity: _lightProbeContext.directLightIntensity,
						ambientIntensity: 0,
						probeIntensity: 0,
						receiverAlbedoMode: options.receiverAlbedoMode,
						receiverAlbedo: options.receiverAlbedo
					} ),
					await captureOffscreenSceneLinearTarget( {
						label: `${ options.labelPrefix ?? '' }ambient-only`,
						directIntensity: 0,
						ambientIntensity: _lightProbeContext.ambientLightIntensity,
						probeIntensity: 0,
						receiverAlbedoMode: options.receiverAlbedoMode,
						receiverAlbedo: options.receiverAlbedo
					} ),
					await captureOffscreenSceneLinearTarget( {
						label: `${ options.labelPrefix ?? '' }direct-plus-probes`,
						directIntensity: _lightProbeContext.directLightIntensity,
						ambientIntensity: _lightProbeContext.ambientLightIntensity,
						probeIntensity: _lightProbeContext.params.probeIntensity,
						receiverAlbedoMode: options.receiverAlbedoMode,
						receiverAlbedo: options.receiverAlbedo
					} )
				];
				const offscreenSceneLinearContributionRows = await captureContributionRows();
				const offscreenSceneLinearNeutralContributionRows = await captureContributionRows( {
					labelPrefix: 'neutral-',
					receiverAlbedoMode: 'neutral-receiver-albedo',
					receiverAlbedo: 0xd8d2c5
				} );
				const createContributionSummary = ( rows, mode ) => {

					const supportedRows = rows.filter( row => row.status === 'SUPPORTED' );
					const dominantWrongSideContribution = supportedRows.reduce( ( best, row ) => (
						best === null || row.maskedWrongSideColorRatio > best.maskedWrongSideColorRatio ? row : best
					), null );
					const findContributionRow = label => rows.find( row => row.label === label ) ?? null;
					const contributionWrongRatio = label => findContributionRow( label )?.maskedWrongSideColorRatio ?? null;
					const contributionRatioDelta = ( a, b, key ) => {

						const rowA = findContributionRow( a );
						const rowB = findContributionRow( b );

						return rowA !== null && rowB !== null &&
									Number.isFinite( rowA[ key ] ) &&
									Number.isFinite( rowB[ key ] ) ?
							roundMetric( Math.abs( rowA[ key ] - rowB[ key ] ) ) :
							null;

					};

					const labelPrefix = mode === 'neutral-receiver-albedo' ? 'neutral-' : '';
					const directAmbientMaskedDelta = contributionRatioDelta( `${ labelPrefix }direct-only`, `${ labelPrefix }ambient-only`, 'maskedWrongSideColorRatio' );
					const probesDirectPlusMaskedDelta = contributionRatioDelta( `${ labelPrefix }probes-only`, `${ labelPrefix }direct-plus-probes`, 'maskedWrongSideColorRatio' );
					const contributionIsolationWarnings = [];

					if ( directAmbientMaskedDelta !== null && directAmbientMaskedDelta <= 0.0001 ) {

						contributionIsolationWarnings.push( 'direct-only and ambient-only offscreen rows are indistinguishable at current precision; direct scene-light separation still needs a stronger fixture/control.' );

					}

					if ( probesDirectPlusMaskedDelta !== null && probesDirectPlusMaskedDelta <= 0.0001 ) {

						contributionIsolationWarnings.push( 'direct-plus-probes matches probes-only at current precision; visible wrong-side color pressure is probe-dominated in this fixture, but scene-light additivity still needs a stronger control.' );

					}

					return {
						status: supportedRows.length === rows.length ? 'SUPPORTED' : 'OPEN',
						mode: `offscreen-half-float-linear-target-contribution-isolation-${ mode }`,
						receiverAlbedoMode: mode,
						rowCount: rows.length,
						supportedRowCount: supportedRows.length,
						dominantWrongSideLabel: dominantWrongSideContribution?.label ?? null,
						dominantWrongSideColorRatio: dominantWrongSideContribution?.maskedWrongSideColorRatio ?? null,
						runtimeProbeIndirectWrongSideColorRatio: contributionWrongRatio( `${ labelPrefix }runtime-probe-indirect-scene-linear` ),
						probeIndirectAfterAlbedoWrongSideColorRatio: contributionWrongRatio( `${ labelPrefix }probe-indirect-after-albedo` ),
						probeIndirectLambertBsdfWrongSideColorRatio: contributionWrongRatio( `${ labelPrefix }probe-indirect-lambert-bsdf` ),
						probesOnlyWrongSideColorRatio: contributionWrongRatio( `${ labelPrefix }probes-only` ),
						directOnlyWrongSideColorRatio: contributionWrongRatio( `${ labelPrefix }direct-only` ),
						ambientOnlyWrongSideColorRatio: contributionWrongRatio( `${ labelPrefix }ambient-only` ),
						directPlusProbesWrongSideColorRatio: contributionWrongRatio( `${ labelPrefix }direct-plus-probes` ),
						directAmbientMaskedDelta,
						probesDirectPlusMaskedDelta,
						maxChromaticityWrongSidePressure: supportedRows.length > 0 ?
							roundMetric( Math.max( ...supportedRows.map( row => row.chromaticityWrongSidePressure ) ) ) :
							null,
						warnings: contributionIsolationWarnings,
						diagnosticConclusion: dominantWrongSideContribution === null ?
							'Contribution isolation did not produce enough masked receiver samples; keep the presentation promotion gate open.' :
							dominantWrongSideContribution.label.endsWith( 'probes-only' ) ?
								'Probe-only offscreen scene-linear contribution has the highest wrong-side ratio; inspect probe content, receiver sampling, and visibility shaping before public promotion.' :
								dominantWrongSideContribution.label.endsWith( 'direct-plus-probes' ) ?
									'Combined direct + probe offscreen scene-linear contribution has the highest wrong-side ratio; inspect additive material/contrast interaction before tuning visibility thresholds.' :
									'Non-probe offscreen scene-linear contribution has the highest wrong-side ratio; isolate direct/ambient material contrast before treating this as a probe leak.'
					};

				};

				const offscreenSceneLinearContributionSummary = createContributionSummary( offscreenSceneLinearContributionRows, 'original-receiver-albedo' );
				const offscreenSceneLinearNeutralContributionSummary = createContributionSummary( offscreenSceneLinearNeutralContributionRows, 'neutral-receiver-albedo' );
				const originalProbeRow = offscreenSceneLinearContributionRows.find( row => row.label === 'probes-only' ) ?? null;
				const neutralProbeRow = offscreenSceneLinearNeutralContributionRows.find( row => row.label === 'neutral-probes-only' ) ?? null;
				const runtimeProbeRow = offscreenSceneLinearContributionRows.find( row => row.label === 'runtime-probe-indirect-scene-linear' ) ?? null;
				const albedoProbeRow = offscreenSceneLinearContributionRows.find( row => row.label === 'probe-indirect-after-albedo' ) ?? null;
				const lambertProbeRow = offscreenSceneLinearContributionRows.find( row => row.label === 'probe-indirect-lambert-bsdf' ) ?? null;
				const visiblePixelCpuMirrorStudy = await captureVisiblePixelCpuMirrorStudy( runtimeProbeRow );
				const neutralVsOriginalProbeDelta = originalProbeRow !== null && neutralProbeRow !== null ?
					roundMetric( Math.abs( originalProbeRow.maskedWrongSideColorRatio - neutralProbeRow.maskedWrongSideColorRatio ) ) :
					null;
				const contributionGateWarnings = [];

				if ( neutralVsOriginalProbeDelta !== null && neutralVsOriginalProbeDelta <= 0.0001 ) {

					contributionGateWarnings.push( 'neutral receiver albedo row matches the original receiver row at current precision; the sealed-wall receiver material was already effectively neutral, so remaining chroma pressure comes from probe content / bounced-light chroma rather than receiver albedo.' );

				}

				const contributionGateThresholds = {
					neutralProbesOnlyWrongSideMax: 1.15,
					neutralProbesOnlyCorrectBounceMin: 0.85,
					neutralChromaticityWrongSidePressureMax: 0.05
				};
				const contributionGateBlockers = [];
				const addContributionBlocker = ( key, value, threshold, failed, finding, severity = 0 ) => {

					if ( failed === false ) return;

					contributionGateBlockers.push( {
						key,
						value: Number.isFinite( value ) ? roundMetric( value ) : null,
						threshold,
						delta: Number.isFinite( value ) && Number.isFinite( threshold ) ? roundMetric( Math.abs( value - threshold ) ) : null,
						normalizedSeverity: roundMetric( severity ),
						finding
					} );

				};

				if ( offscreenSceneLinearContributionSummary.status !== 'SUPPORTED' ) {

					contributionGateBlockers.push( {
						key: 'originalContributionRows',
						value: offscreenSceneLinearContributionSummary.status,
						threshold: 'SUPPORTED',
						delta: null,
						normalizedSeverity: 1,
						finding: 'Original receiver offscreen contribution isolation did not produce all required supported rows.'
					} );

				}

				if ( offscreenSceneLinearNeutralContributionSummary.status !== 'SUPPORTED' ) {

					contributionGateBlockers.push( {
						key: 'neutralContributionRows',
						value: offscreenSceneLinearNeutralContributionSummary.status,
						threshold: 'SUPPORTED',
						delta: null,
						normalizedSeverity: 1,
						finding: 'Neutral receiver offscreen contribution isolation did not produce all required supported rows.'
					} );

				}

				if ( neutralProbeRow === null ) {

					contributionGateBlockers.push( {
						key: 'neutralProbesOnly',
						value: null,
						threshold: 'captured row',
						delta: null,
						normalizedSeverity: 1,
						finding: 'Neutral receiver probe-only row was not captured.'
					} );

				} else {

					addContributionBlocker(
						'neutralProbesOnlyWrongSide',
						neutralProbeRow.maskedWrongSideColorRatio,
						contributionGateThresholds.neutralProbesOnlyWrongSideMax,
						neutralProbeRow.maskedWrongSideColorRatio > contributionGateThresholds.neutralProbesOnlyWrongSideMax,
						'Neutral probe-only wrong-side ratio is above the conservative scene-linear promotion threshold.',
						( neutralProbeRow.maskedWrongSideColorRatio - contributionGateThresholds.neutralProbesOnlyWrongSideMax ) / contributionGateThresholds.neutralProbesOnlyWrongSideMax
					);
					addContributionBlocker(
						'neutralProbesOnlyCorrectBounce',
						neutralProbeRow.maskedCorrectBounceRatio,
						contributionGateThresholds.neutralProbesOnlyCorrectBounceMin,
						neutralProbeRow.maskedCorrectBounceRatio < contributionGateThresholds.neutralProbesOnlyCorrectBounceMin,
						'Neutral probe-only correct-bounce ratio is below the conservative scene-linear promotion threshold.',
						( contributionGateThresholds.neutralProbesOnlyCorrectBounceMin - neutralProbeRow.maskedCorrectBounceRatio ) / contributionGateThresholds.neutralProbesOnlyCorrectBounceMin
					);
					addContributionBlocker(
						'neutralChromaticityWrongSidePressure',
						neutralProbeRow.chromaticityWrongSidePressure,
						contributionGateThresholds.neutralChromaticityWrongSidePressureMax,
						neutralProbeRow.chromaticityWrongSidePressure > contributionGateThresholds.neutralChromaticityWrongSidePressureMax,
						'Neutral probe-only chromaticity wrong-side pressure is above the conservative scene-linear promotion threshold.',
						( neutralProbeRow.chromaticityWrongSidePressure - contributionGateThresholds.neutralChromaticityWrongSidePressureMax ) / contributionGateThresholds.neutralChromaticityWrongSidePressureMax
					);

				}

				const dominantContributionBlocker = contributionGateBlockers
					.slice()
					.sort( ( a, b ) => ( b.normalizedSeverity ?? 0 ) - ( a.normalizedSeverity ?? 0 ) )[ 0 ] ?? null;
				const contributionGateSupported = contributionGateBlockers.length === 0;
				const receiverAlbedoBounded = neutralVsOriginalProbeDelta !== null && neutralVsOriginalProbeDelta <= 0.0001;
				const probeDominated = offscreenSceneLinearContributionSummary.probesDirectPlusMaskedDelta !== null &&
					offscreenSceneLinearContributionSummary.probesDirectPlusMaskedDelta <= 0.0001;
				const directAmbientSeparationWeak = offscreenSceneLinearContributionSummary.directAmbientMaskedDelta !== null &&
					offscreenSceneLinearContributionSummary.directAmbientMaskedDelta <= 0.0001;
				const dominantContributionSource = receiverAlbedoBounded && probeDominated ?
					'probe-content-or-visibility-shaping' :
					receiverAlbedoBounded ?
						'non-albedo-contribution-pressure' :
						'receiver-albedo-or-material-pressure';
				const offscreenSceneLinearContributionGate = {
					status: contributionGateSupported ?
						'SUPPORTED' :
						dominantContributionSource === 'probe-content-or-visibility-shaping' ?
							'OPEN-PROBE-CONTENT-OR-VISIBILITY-SHAPING' :
							'OPEN-CONTRIBUTION-PRESSURE',
					mode: 'proof-only-offscreen-scene-linear-contribution-gate',
					promotionRole: 'scene-linear-contribution-promotion-blocker',
					publicApiPromotion: false,
					thresholds: contributionGateThresholds,
					neutralProbesOnly: neutralProbeRow === null ? null : {
						maskedWrongSideColorRatio: neutralProbeRow.maskedWrongSideColorRatio,
						maskedCorrectBounceRatio: neutralProbeRow.maskedCorrectBounceRatio,
						chromaticityWrongSidePressure: neutralProbeRow.chromaticityWrongSidePressure,
						wrongSideExcess: roundMetric( Math.max( neutralProbeRow.maskedWrongSideColorRatio - contributionGateThresholds.neutralProbesOnlyWrongSideMax, 0 ) ),
						correctBounceDeficit: roundMetric( Math.max( contributionGateThresholds.neutralProbesOnlyCorrectBounceMin - neutralProbeRow.maskedCorrectBounceRatio, 0 ) ),
						chromaticityPressureExcess: roundMetric( Math.max( neutralProbeRow.chromaticityWrongSidePressure - contributionGateThresholds.neutralChromaticityWrongSidePressureMax, 0 ) )
					},
					blockers: contributionGateBlockers,
					dominantBlocker: dominantContributionBlocker,
					dominantContributionSource,
					sourceAttribution: {
						receiverAlbedoBounded,
						probeDominated,
						directAmbientSeparationWeak,
						neutralVsOriginalProbeDelta,
						probesDirectPlusMaskedDelta: offscreenSceneLinearContributionSummary.probesDirectPlusMaskedDelta,
						directAmbientMaskedDelta: offscreenSceneLinearContributionSummary.directAmbientMaskedDelta
					},
					neutralVsOriginalProbeDelta,
					warnings: contributionGateWarnings,
					diagnosticConclusion: neutralProbeRow === null ?
						'Neutral receiver probe-only row was not captured; keep promotion closed.' :
						contributionGateSupported ?
							'Neutral receiver probe-only wrong-side, correct-bounce, and chromaticity pressure are inside conservative proof thresholds.' :
							'Neutral receiver probe-only contribution remains outside conservative scene-linear thresholds; receiver albedo is bounded at current precision, so inspect probe content / bounced-light chroma and visibility shaping before tuning moments or Chebyshev thresholds.'
				};
				const ratioDelta = ( a, b, key ) => roundMetric( Math.abs(
					a.leakMetrics[ key ] - b.leakMetrics[ key ]
				) );
				const standardVsDebugMaskedDelta = ratioDelta( standardCurrent, debugFinalIrradiance, 'maskedWrongSideColorRatio' );
				const toneMappingMaskedDelta = ratioDelta( standardCurrent, standardNoToneMapping, 'maskedWrongSideColorRatio' );
				const standardVsDebugSurfaceDelta = ratioDelta( standardCurrent, debugFinalIrradiance, 'surfaceWrongSideColorRatio' );
				const toneMappingSurfaceDelta = ratioDelta( standardCurrent, standardNoToneMapping, 'surfaceWrongSideColorRatio' );
				const outputColorSpaceMaskedDelta = ratioDelta( standardNoToneMapping, standardLinearOutput, 'maskedWrongSideColorRatio' );
				const lambertVsStandardLinearMaskedDelta = ratioDelta( standardLinearOutput, debugLambert, 'maskedWrongSideColorRatio' );
				const rowRatioDelta = ( a, b, key = 'maskedWrongSideColorRatio' ) => a !== null && b !== null &&
					Number.isFinite( a[ key ] ) &&
					Number.isFinite( b[ key ] ) ?
					roundMetric( Math.abs( a[ key ] - b[ key ] ) ) :
					null;
				const runtimeProbeCpuDeltaMean = runtimeProbeRow !== null ?
					roundMetric( Math.abs( runtimeProbeRow.maskedWrongSideColorRatio - surfaceCpuRatioMean ) ) :
					null;
				const runtimeProbeCpuDeltaMax = runtimeProbeRow !== null ?
					roundMetric( Math.abs( runtimeProbeRow.maskedWrongSideColorRatio - surfaceCpuRatioMax ) ) :
					null;
				const visiblePixelCpuMirrorDeltaMean = visiblePixelCpuMirrorStudy.summary.cpuGpuWrongSideRatioDeltaMean ?? null;
				const visiblePixelCpuMirrorDeltaMax = visiblePixelCpuMirrorStudy.summary.cpuGpuWrongSideRatioDeltaMax ?? null;
				const visiblePixelCpuMirrorSupported = visiblePixelCpuMirrorStudy.status === 'SUPPORTED-VISIBLE-PIXEL-CPU-GPU-SCENE-LINEAR-PARITY';
				const runtimeProbeAlbedoDelta = rowRatioDelta( runtimeProbeRow, albedoProbeRow );
				const albedoLambertDelta = rowRatioDelta( albedoProbeRow, lambertProbeRow );
				const lambertStandardProbeDelta = rowRatioDelta( lambertProbeRow, originalProbeRow );
				const runtimeStandardProbeDelta = rowRatioDelta( runtimeProbeRow, originalProbeRow );
				const finiteProbeMaterialPathDeltas = [
					runtimeProbeAlbedoDelta,
					albedoLambertDelta,
					lambertStandardProbeDelta,
					runtimeStandardProbeDelta
				].filter( Number.isFinite );
				const probeMaterialPathDelta = finiteProbeMaterialPathDeltas.length > 0 ?
					roundMetric( Math.max( ...finiteProbeMaterialPathDeltas ) ) :
					null;
				const exposureSweep = [
					standardAcesExposureHalf,
					standardCurrent,
					standardAcesExposureDouble
				].map( variant => ( {
					label: variant.label,
					exposure: variant.toneMappingExposure,
					maskedWrongSideColorRatio: variant.leakMetrics.maskedWrongSideColorRatio,
					maskedCorrectBounceRatio: variant.leakMetrics.maskedCorrectBounceRatio,
					deltaFromCurrentMaskedWrongSide: ratioDelta( standardCurrent, variant, 'maskedWrongSideColorRatio' )
				} ) );
				const exposureMaskedDelta = roundMetric( Math.max(
					...exposureSweep.map( row => row.deltaFromCurrentMaskedWrongSide )
				) );
				const bsdfIntegrationSupported = probeMaterialPathDelta !== null && probeMaterialPathDelta <= 0.05;
				const materialAmplificationSuspected = bsdfIntegrationSupported === false;
				const toneMappingAmplificationSuspected = toneMappingMaskedDelta > 0.05 ||
							toneMappingSurfaceDelta > 0.05 ||
							outputColorSpaceMaskedDelta > 0.05 ||
							exposureMaskedDelta > 0.05;
				const visiblePixelMismatchOpen = visiblePixelCpuMirrorSupported === false &&
					visiblePixelCpuMirrorStudy.summary.dominantMismatchSource !== undefined &&
					visiblePixelCpuMirrorStudy.summary.dominantMismatchSource !== 'none-within-visible-pixel-thresholds';
				const cpuGpuAggregateOpen = visiblePixelCpuMirrorSupported === false &&
					Math.min( runtimeProbeCpuDeltaMean ?? Infinity, runtimeProbeCpuDeltaMax ?? Infinity ) > 0.15;
				const dominantColorMappingSource = exposureMaskedDelta > 0.05 ?
					'tone-mapping-exposure-response' :
					toneMappingMaskedDelta > 0.05 ?
						'tone-mapping-output-transform' :
						outputColorSpaceMaskedDelta > 0.05 ?
							'output-color-space-transform' :
							'none-within-current-thresholds';
				const colorMappingDiagnostic = {
					status: toneMappingAmplificationSuspected ?
						'OPEN-COLOR-MAPPING-DIAGNOSTIC' :
						'SUPPORTED-COLOR-MAPPING-BOUNDED',
					promotionEligible: false,
					dominantMismatchSource: dominantColorMappingSource,
					toneMappingMaskedDelta,
					toneMappingSurfaceDelta,
					outputColorSpaceMaskedDelta,
					exposureMaskedDelta,
					diagnosticConclusion: toneMappingAmplificationSuspected ?
						'Renderer tone mapping, exposure, or output color-space reshapes visible wrong-side ratios; keep this as presentation-only diagnostic pressure rather than blocking scene-linear material/probe promotion.' :
						'Renderer tone mapping, exposure, and output color-space deltas are bounded for this fixture.'
				};
				const sceneLinearMismatchClassifier = {
					status: runtimeProbeRow === null || runtimeProbeRow.status !== 'SUPPORTED' ?
						'OPEN-DEBUG-TARGET' :
						visiblePixelCpuMirrorSupported ?
							materialAmplificationSuspected ? 'OPEN-BSDF' :
								'SUPPORTED' :
						cpuGpuAggregateOpen ?
							'OPEN-CPU-GPU' :
							materialAmplificationSuspected ?
								'OPEN-BSDF' :
								'SUPPORTED',
					mode: 'receiver-mask-debug-runtime-albedo-lambert-bsdf-tone-map-classifier',
					tolerance: 0.15,
					dominantMismatchSource: runtimeProbeRow === null || runtimeProbeRow.status !== 'SUPPORTED' ?
						'receiver-mask-or-debug-target' :
						visiblePixelMismatchOpen ?
							visiblePixelCpuMirrorStudy.summary.dominantMismatchSource :
						cpuGpuAggregateOpen ?
							'debug-runtime-path-or-cpu-weighting' :
						materialAmplificationSuspected ?
							'probe-material-bsdf-path' :
							'none-within-current-thresholds',
					runtimeProbeCpuDeltaMean,
					runtimeProbeCpuDeltaMax,
					visiblePixelCpuMirrorStatus: visiblePixelCpuMirrorStudy.status,
					visiblePixelCpuMirrorDeltaMean,
					visiblePixelCpuMirrorDeltaMax,
					visiblePixelCpuMirrorDominantMismatchSource: visiblePixelCpuMirrorStudy.summary.dominantMismatchSource,
					runtimeProbeAlbedoDelta,
					albedoLambertDelta,
					lambertStandardProbeDelta,
					runtimeStandardProbeDelta,
					probeMaterialPathDelta,
					standardLinearVsProbeOnlyLambertMaskedDelta: lambertVsStandardLinearMaskedDelta,
					toneMappingMaskedDelta,
					outputColorSpaceMaskedDelta,
					exposureMaskedDelta,
					colorMappingDiagnostic,
					receiverMaskOverlay: runtimeProbeRow !== null && runtimeProbeRow.leftReceiverMasked.samples > 0 && runtimeProbeRow.rightReceiverMasked.samples > 0,
					diagnosticConclusion: runtimeProbeRow === null || runtimeProbeRow.status !== 'SUPPORTED' ?
						'Runtime-equivalent probe-indirect offscreen row did not capture both receiver masks; do not promote presentation color.' :
						visiblePixelMismatchOpen ?
							'Runtime-equivalent probe-indirect scene-linear pixels still disagree with the exact GPU-read visible-pixel CPU mirror; patch that before touching material or visibility thresholds.' :
						cpuGpuAggregateOpen ?
							'Runtime-equivalent probe-indirect scene-linear row still disagrees with CPU surface SH attribution; inspect debug/runtime weighting and CPU mirror before tuning visibility.' :
						materialAmplificationSuspected ?
							'Runtime-equivalent probe-indirect agrees with the visible-pixel CPU mirror, but the probe albedo / Lambert / standard-probe material rows diverge beyond threshold.' :
						toneMappingAmplificationSuspected ?
							'Runtime-equivalent probe-indirect and probe material rows are bounded; tone mapping / exposure / output-color pressure is tracked as a diagnostic-only presentation transform, not a scene-linear material blocker.' :
							'Runtime-equivalent probe-indirect, receiver mask, albedo, BSDF, and tone-mapping transforms are bounded for this fixture.'
				};
				const status = materialAmplificationSuspected ?
					'OPEN-BSDF' :
					'SUPPORTED';

				return {
					status,
					proofBoundary: 'Proof-only presentation receiver audit; compares original lit receiver material, renderer tone-mapping toggle, and MeshBasic final-irradiance debug output without changing runtime constants or public API.',
					renderer: {
						currentToneMapping: toneMappingName( currentToneMapping ),
						currentToneMappingExposure,
						outputColorSpace: colorSpaceName( currentOutputColorSpace )
					},
					variants: [
						standardCurrent,
						standardAcesExposureHalf,
						standardAcesExposureDouble,
						standardNoToneMapping,
						standardLinearOutput,
						debugFinalIrradiance,
						debugLambert
					],
					summary: {
						standardMaskedWrongSideColorRatio: standardCurrent.leakMetrics.maskedWrongSideColorRatio,
						debugMaskedWrongSideColorRatio: debugFinalIrradiance.leakMetrics.maskedWrongSideColorRatio,
						noToneMappingMaskedWrongSideColorRatio: standardNoToneMapping.leakMetrics.maskedWrongSideColorRatio,
						linearOutputMaskedWrongSideColorRatio: standardLinearOutput.leakMetrics.maskedWrongSideColorRatio,
						lambertDebugMaskedWrongSideColorRatio: debugLambert.leakMetrics.maskedWrongSideColorRatio,
						standardVsDebugMaskedDelta,
						standardVsDebugSurfaceDelta,
						toneMappingMaskedDelta,
						toneMappingSurfaceDelta,
						outputColorSpaceMaskedDelta,
						exposureMaskedDelta,
						exposureSweep,
						offscreenSceneLinearTarget,
						offscreenSceneLinearContributionRows,
						offscreenSceneLinearContributionSummary,
						offscreenSceneLinearNeutralContributionRows,
						offscreenSceneLinearNeutralContributionSummary,
						offscreenSceneLinearContributionGate,
						visiblePixelCpuMirrorStudy,
						sceneLinearMismatchClassifier,
						runtimeProbeCpuDeltaMean,
						runtimeProbeCpuDeltaMax,
						visiblePixelCpuMirrorDeltaMean,
						visiblePixelCpuMirrorDeltaMax,
						runtimeProbeAlbedoDelta,
						albedoLambertDelta,
						lambertStandardProbeDelta,
						runtimeStandardProbeDelta,
						probeMaterialPathDelta,
						standardLinearVsProbeOnlyLambertMaskedDelta: lambertVsStandardLinearMaskedDelta,
						lambertVsStandardLinearMaskedDelta,
						bsdfIntegrationSupported,
						materialAmplificationSuspected,
						toneMappingAmplificationSuspected,
						colorMappingDiagnostic,
						diagnosticConclusion: materialAmplificationSuspected ?
							'Probe albedo / Lambert / standard-probe material rows do not agree closely enough; inspect BSDF/light-node integration before tuning visibility thresholds.' :
							toneMappingAmplificationSuspected ?
								'Probe albedo / Lambert / standard-probe material rows are bounded; tone mapping / exposure / output color-space pressure remains diagnostic-only and does not block the scene-linear material gate.' :
								'Original receiver material, tone mapping, and MeshBasic final-irradiance debug path are close enough that the remaining leak is more likely coefficient/content/visibility shaping than color-space amplification.'
					}
				};

			} finally {

				_lightProbeContext.leakFixture.leftReceiver.material = currentLeftMaterial;
				_lightProbeContext.leakFixture.rightReceiver.material = currentRightMaterial;
				_lightProbeContext.probeGrid.visibilityDepthWeighting.value = currentVisibilityWeighting;
				_lightProbeContext.renderer.toneMapping = currentToneMapping;
				_lightProbeContext.renderer.toneMappingExposure = currentToneMappingExposure;
				_lightProbeContext.renderer.outputColorSpace = currentOutputColorSpace;
				debugMaterial.dispose();
				runtimeProbeIndirectMaterial.dispose();
				albedoDebugMaterial.dispose();
				lambertDebugMaterial.dispose();
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

			}

		};

		const captureVariant = ( variant ) => {

			const material = createDebugMaterial( variant );

			try {

				_lightProbeContext.probeGrid.visibilityDepthWeighting.value = variant.visibilityDepthWeighting;
				_lightProbeContext.leakFixture.leftReceiver.material = material;
				_lightProbeContext.leakFixture.rightReceiver.material = material;
				_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

				const leakMetrics = captureLeakRegionMetrics();
				const canvasSample = captureCanvasSample();
				const pointMetrics = createTightSurfacePointMetrics( canvasSample );
				const termMetrics = variant.debugRenderFamily === 'probe-weight' ?
					createTightSurfaceTermMetrics( canvasSample, variant, whiteCalibrationLuminanceMean ) :
					null;
				const linearIrradianceMetrics = variant.debugRenderFamily === 'irradiance-linear-term' ?
					createTightSurfaceIrradianceTermMetrics( canvasSample, variant ) :
					null;
				const surfaceWrongSideColorRatio = leakMetrics.surfaceWrongSideColorRatio;
				const regionCpuComparison = createCpuAggregationComparison(
					roundMetric( (
						leakMetrics.surfaceRegions.leftReceiverSurface.colorBias.greenOverRed +
								leakMetrics.surfaceRegions.rightReceiverSurface.colorBias.redOverGreen
					) * 0.5 ),
					surfaceWrongSideColorRatio
				);
				const surfaceCpuDelta = variant.debugRenderFamily === 'irradiance' ?
					regionCpuComparison.delta :
					null;

				return {
					label: variant.label,
					debugRenderMode: variant.node ?? 'material-color',
					debugRenderFamily: variant.debugRenderFamily,
					visibilityDepthWeighting: variant.visibilityDepthWeighting,
					debugScale: variant.debugScale ?? null,
					debugMode: variant.debugMode ?? null,
					cpuTermKey: variant.cpuTermKey ?? null,
					cpuIrradianceTermKey: variant.cpuIrradianceTermKey ?? null,
					material: variant.material,
					leakMetrics: createMetricSummary( leakMetrics ),
					pointMetrics,
					termMetrics,
					linearIrradianceMetrics,
					termCpuDeltaMean: termMetrics === null ? null : termMetrics.termDeltaMean,
					termCpuDeltaMax: termMetrics === null ? null : termMetrics.termDeltaMax,
					linearIrradianceCpuDeltaMean: linearIrradianceMetrics === null ? null : linearIrradianceMetrics.linearRgbDeltaMean,
					linearIrradianceCpuDeltaMax: linearIrradianceMetrics === null ? null : linearIrradianceMetrics.linearRgbDeltaMax,
					surfaceCpuDelta,
					surfaceCpuDeltaMean: variant.debugRenderFamily === 'irradiance' ? regionCpuComparison.meanDelta : null,
					surfaceCpuDeltaMax: variant.debugRenderFamily === 'irradiance' ? regionCpuComparison.maxDelta : null,
					surfaceCpuAggregation: variant.debugRenderFamily === 'irradiance' ? regionCpuComparison.aggregation : null,
					surfaceCpuRatio: variant.debugRenderFamily === 'irradiance' ? regionCpuComparison.cpuRatio : null
				};

			} finally {

				material.dispose();

			}

		};

		try {

			const calibrationVariants = [
				{
					label: 'receiverWhiteCalibration',
					debugRenderFamily: 'calibration',
					visibilityDepthWeighting: previousVisibilityWeighting,
					color: 0xffffff,
					material: 'MeshBasicNodeMaterial color=white; toneMapped=false'
				},
				{
					label: 'normalWorldReceiver',
					debugRenderFamily: 'geometry',
					visibilityDepthWeighting: previousVisibilityWeighting,
					node: 'normalWorld',
					material: 'MeshBasicNodeMaterial colorNode = normalWorld * 0.5 + 0.5; toneMapped=false'
				},
				{
					label: 'positionWorldGridReceiver',
					debugRenderFamily: 'geometry',
					visibilityDepthWeighting: previousVisibilityWeighting,
					node: 'positionWorldGrid',
					material: 'MeshBasicNodeMaterial colorNode = ( positionWorld - gridMin ) / gridExtent; toneMapped=false'
				}
			];
			const calibrationResults = calibrationVariants.map( captureVariant );
			const whiteCalibration = calibrationResults.find( variant => variant.label === 'receiverWhiteCalibration' );

			whiteCalibrationLuminanceMean = roundMetric(
				(
					whiteCalibration.leakMetrics.leftSurfaceLuminance.mean +
							whiteCalibration.leakMetrics.rightSurfaceLuminance.mean
				) * 0.5
			);

			const receiverPixelParityVectorModes = [
				{
					label: 'SamplePositionGrid',
					debugMode: 'samplePositionGrid',
					material: 'MeshBasicNodeMaterial colorNode = private samplePosition normalized to grid; toneMapped=false'
				},
				{
					label: 'ProbeCoordGrid',
					debugMode: 'probeCoordGrid',
					material: 'MeshBasicNodeMaterial colorNode = private probeCoord / (resolution - 1); toneMapped=false'
				},
				{
					label: 'BaseProbeCoordGrid',
					debugMode: 'baseProbeCoordGrid',
					material: 'MeshBasicNodeMaterial colorNode = private floor(probeCoord) / (resolution - 1); toneMapped=false'
				},
				{
					label: 'TrilinearBlend',
					debugMode: 'trilinearBlend',
					material: 'MeshBasicNodeMaterial colorNode = private fract(probeCoord); toneMapped=false'
				}
			];
			const receiverPixelParityVectorVariants = receiverPixelParityVectorModes.map( mode => ( {
				label: `receiverPixel${ mode.label }`,
				debugRenderFamily: 'receiver-pixel-parity-vector',
				visibilityDepthWeighting: 1,
				debugScale: 1,
				node: 'manualIrradianceDebug',
				debugMode: mode.debugMode,
				material: mode.material
			} ) );
			const receiverPixelParityNeighborVariants = Array.from( { length: 8 }, ( _, slot ) => [
				{
					label: `receiverPixelNeighbor${ slot }ProbeIndex`,
					debugMode: `neighbor${ slot }ProbeIndex`,
					material: `MeshBasicNodeMaterial colorNode = private neighbor ${ slot } probeIndex / maxProbeIndex; toneMapped=false`
				},
				{
					label: `receiverPixelNeighbor${ slot }BaseWeight`,
					debugMode: `neighbor${ slot }BaseWeight`,
					material: `MeshBasicNodeMaterial colorNode = private neighbor ${ slot } baseWeight; toneMapped=false`
				},
				{
					label: `receiverPixelNeighbor${ slot }Visibility`,
					debugMode: `neighbor${ slot }Visibility`,
					material: `MeshBasicNodeMaterial colorNode = private neighbor ${ slot } visibility; toneMapped=false`
				},
				{
					label: `receiverPixelNeighbor${ slot }VisibilityWeight`,
					debugMode: `neighbor${ slot }VisibilityWeight`,
					material: `MeshBasicNodeMaterial colorNode = private neighbor ${ slot } visibilityWeight; toneMapped=false`
				}
			] ).flat().map( mode => ( {
				label: mode.label,
				debugRenderFamily: 'receiver-pixel-parity-scalar',
				visibilityDepthWeighting: 1,
				debugScale: 1,
				node: 'manualIrradianceDebug',
				debugMode: mode.debugMode,
				material: mode.material
			} ) );
			const irradianceVariants = debugScales.flatMap( debugScale => [
				{
					label: `probeIrradianceScalar-scale-${ debugScale }`,
					debugRenderFamily: 'irradiance',
					visibilityDepthWeighting: 0,
					debugScale,
					node: 'irradiance',
					material: 'MeshBasicNodeMaterial colorNode = LightProbeGridGPU.createIrradianceNode() * debugScale; toneMapped=false'
				},
				{
					label: `probeIrradianceVisibility-scale-${ debugScale }`,
					debugRenderFamily: 'irradiance',
					visibilityDepthWeighting: 1,
					debugScale,
					node: 'irradiance',
					material: 'MeshBasicNodeMaterial colorNode = LightProbeGridGPU.createIrradianceNode() * debugScale; toneMapped=false'
				}
			] );
			const irradianceTermDebugModes = [
				{
					label: 'Scalar',
					debugMode: 'scalarIrradiance',
					cpuIrradianceTermKey: 'scalar'
				},
				{
					label: 'Visibility',
					debugMode: 'visibilityIrradiance',
					cpuIrradianceTermKey: 'visibility'
				},
				{
					label: 'Final',
					debugMode: 'finalIrradiance',
					cpuIrradianceTermKey: 'final'
				}
			];
			const irradianceTermVariants = debugScales.flatMap( debugScale => irradianceTermDebugModes.map( debugMode => ( {
				label: `probe${ debugMode.label }IrradianceTerm-scale-${ debugScale }`,
				debugRenderFamily: 'irradiance-linear-term',
				visibilityDepthWeighting: 1,
				debugScale,
				node: 'manualIrradianceDebug',
				debugMode: debugMode.debugMode,
				cpuIrradianceTermKey: debugMode.cpuIrradianceTermKey,
				material: `MeshBasicNodeMaterial colorNode = LightProbeGridGPU._createManualIrradianceDebugNode( '${ debugMode.debugMode }' ) * debugScale; toneMapped=false`
			} ) ) );

			const weightDebugModes = [
				{
					label: 'ScalarTotal',
					debugMode: 'scalarWeight',
					cpuTermKey: 'scalarTotalWeight'
				},
				{
					label: 'VisibilityTotal',
					debugMode: 'visibilityWeight',
					cpuTermKey: 'visibilityTotalWeight'
				},
				{
					label: 'VisibilityMix',
					debugMode: 'visibilityMix',
					cpuTermKey: 'runtimeVisibilityMix'
				},
				{
					label: 'VisibilityOverScalar',
					debugMode: 'visibilityOverScalar',
					cpuTermKey: 'visibilityOverScalar'
				}
			];
			const weightVariants = weightDebugScales.flatMap( debugScale => weightDebugModes.map( debugMode => ( {
				label: `probeWeight${ debugMode.label }-scale-${ debugScale }`,
				debugRenderFamily: 'probe-weight',
				visibilityDepthWeighting: 1,
				debugScale,
				node: 'manualIrradianceDebug',
				debugMode: debugMode.debugMode,
				cpuTermKey: debugMode.cpuTermKey,
				material: `MeshBasicNodeMaterial colorNode = LightProbeGridGPU._createManualIrradianceDebugNode( '${ debugMode.debugMode }' ) * debugScale; toneMapped=false`
			} ) ) );
			const variants = [
				...calibrationResults,
				...receiverPixelParityVectorVariants.map( captureVariant ),
				...irradianceVariants.map( captureVariant ),
				...irradianceTermVariants.map( captureVariant ),
				...weightVariants.map( captureVariant ),
				...receiverPixelParityNeighborVariants.map( captureVariant )
			];
			const comparableVariants = variants.filter( variant => variant.debugRenderFamily === 'irradiance' );
			const irradianceTermMetricVariants = variants.filter( variant => variant.debugRenderFamily === 'irradiance-linear-term' );
			const weightTermVariants = variants.filter( variant => variant.debugRenderFamily === 'probe-weight' );
			const bestVariant = comparableVariants.reduce( ( best, variant ) =>
				variant.surfaceCpuDelta < best.surfaceCpuDelta ? variant : best
			);
			const bestPointVariant = comparableVariants.reduce( ( best, variant ) =>
				variant.pointMetrics.surfaceCpuDelta < best.pointMetrics.surfaceCpuDelta ? variant : best
			);
			const bestWeightTermVariant = weightTermVariants.reduce( ( best, variant ) =>
				variant.termMetrics.termDeltaMean < best.termMetrics.termDeltaMean ? variant : best
			);
			const bestIrradianceTermVariant = irradianceTermMetricVariants.reduce( ( best, variant ) =>
				variant.linearIrradianceMetrics.linearRgbDeltaMean < best.linearIrradianceMetrics.linearRgbDeltaMean ? variant : best
			);
			const presentationStudy = await capturePresentationStudy();
			const receiverPixelParityStudy = createReceiverPixelParityStudy( variants, presentationStudy );

			const pointAgreementSupported = bestPointVariant.pointMetrics.surfaceCpuDelta <= surfaceQuadratureDiagnostic.summary.agreementTolerance;
			const weightTermAgreementSupported = bestWeightTermVariant.termMetrics.termDeltaMean <= surfaceQuadratureDiagnostic.summary.agreementTolerance;
			const irradianceTermAgreementTolerance = 0.08;
			const irradianceTermAgreementSupported = bestIrradianceTermVariant.linearIrradianceMetrics.linearRgbDeltaMean <= irradianceTermAgreementTolerance;

			return {
				status: pointAgreementSupported ?
					'SUPPORTED-GPU-DEBUG-MATCHES-CPU-SURFACE' :
					'OPEN-GPU-DEBUG-CPU-SURFACE-MISMATCH',
				fixtureMode,
				proofBoundary: 'Proof-only GPU debug material renders receiver calibration, normalWorld, positionWorld-grid, createIrradianceNode() scale sweeps, private _createManualIrradianceDebugNode() weight sweeps, and scalar/visibility/final irradiance linear RGB term sweeps; diagnostic canvas/readback comparison only, not runtime CPU readback or public API.',
				variants,
				presentationStudy,
				receiverPixelParityStudy,
				summary: {
					surfaceCpuRatio: surfaceCpuRatioMean,
					surfaceCpuRatioMean,
					surfaceCpuRatioMax,
					bestVariant: bestVariant.label,
					bestVariantScale: bestVariant.debugScale,
					bestSurfaceCpuDelta: bestVariant.surfaceCpuDelta,
					bestVariantCpuAggregation: bestVariant.surfaceCpuAggregation,
					bestTightPointVariant: bestPointVariant.label,
					bestTightPointVariantScale: bestPointVariant.debugScale,
					bestTightPointSurfaceWrongRatio: bestPointVariant.pointMetrics.surfaceWrongRatioMean,
					bestTightPointSurfaceWrongRatioMax: bestPointVariant.pointMetrics.surfaceWrongRatioMax,
					bestTightPointSurfaceCpuDelta: bestPointVariant.pointMetrics.surfaceCpuDelta,
					bestTightPointCpuAggregation: bestPointVariant.pointMetrics.surfaceCpuAggregation,
					bestWeightTermVariant: bestWeightTermVariant.label,
					bestWeightTerm: bestWeightTermVariant.debugMode,
					bestWeightTermCpuKey: bestWeightTermVariant.cpuTermKey,
					bestWeightTermScale: bestWeightTermVariant.debugScale,
					bestWeightTermDeltaMean: bestWeightTermVariant.termMetrics.termDeltaMean,
					bestWeightTermDeltaMax: bestWeightTermVariant.termMetrics.termDeltaMax,
					bestLinearIrradianceTermVariant: bestIrradianceTermVariant.label,
					bestLinearIrradianceTerm: bestIrradianceTermVariant.debugMode,
					bestLinearIrradianceCpuKey: bestIrradianceTermVariant.cpuIrradianceTermKey,
					bestLinearIrradianceTermScale: bestIrradianceTermVariant.debugScale,
					bestLinearIrradianceDeltaMean: bestIrradianceTermVariant.linearIrradianceMetrics.linearRgbDeltaMean,
					bestLinearIrradianceDeltaMax: bestIrradianceTermVariant.linearIrradianceMetrics.linearRgbDeltaMax,
					bestLinearIrradianceClippedSampleCount: bestIrradianceTermVariant.linearIrradianceMetrics.clippedSampleCount,
					linearIrradianceAgreementTolerance: irradianceTermAgreementTolerance,
					linearIrradianceAgreementGate: irradianceTermAgreementSupported ? 'SUPPORTED' : 'OPEN',
					linearIrradianceAgreementMode: irradianceTermAgreementSupported ? 'gpu-linear-rgb-point-samples' : 'open',
					weightTermAgreementGate: weightTermAgreementSupported ? 'SUPPORTED' : 'OPEN',
					weightTermAgreementMode: weightTermAgreementSupported ? 'gpu-term-point-samples' : 'open',
					receiverPixelParityStatus: receiverPixelParityStudy.status,
					receiverPixelParityDominantMismatchSource: receiverPixelParityStudy.summary.dominantMismatchSource,
					receiverPixelParityMaskOcclusionPolicy: receiverPixelParityStudy.summary.maskOcclusionPolicy,
					receiverPixelParityLegacyMaskWrongSideDelta: receiverPixelParityStudy.summary.legacyMaskWrongSideDelta,
					visiblePixelCpuMirrorStatus: presentationStudy.summary.visiblePixelCpuMirrorStudy?.status ?? null,
					visiblePixelCpuMirrorDominantMismatchSource: presentationStudy.summary.visiblePixelCpuMirrorStudy?.summary?.dominantMismatchSource ?? null,
					visiblePixelCpuMirrorDeltaMean: presentationStudy.summary.visiblePixelCpuMirrorDeltaMean ?? null,
					visiblePixelCpuMirrorDeltaMax: presentationStudy.summary.visiblePixelCpuMirrorDeltaMax ?? null,
					agreementMode: pointAgreementSupported ? 'tight-surface-point-samples' : 'open',
					comparableVariantCount: comparableVariants.length,
					linearIrradianceTermVariantCount: irradianceTermMetricVariants.length,
					weightTermVariantCount: weightTermVariants.length,
					whiteCalibrationLuminanceMean,
					whiteCalibrationVisible: whiteCalibrationLuminanceMean > 32,
					presentationGate: presentationStudy.status,
					presentationDiagnosticConclusion: presentationStudy.summary.diagnosticConclusion
				}
			};

		} finally {

			_lightProbeContext.leakFixture.leftReceiver.material = previousLeftMaterial;
			_lightProbeContext.leakFixture.rightReceiver.material = previousRightMaterial;
			_lightProbeContext.probeGrid.visibilityDepthWeighting.value = previousVisibilityWeighting;
			_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );

		}

	};

	return {
		createGaussLegendreReceiverSamples,
		createReceiverSurfaceQuadratureDiagnostic,
		captureReceiverGpuDebugDiagnostics
	};

}
