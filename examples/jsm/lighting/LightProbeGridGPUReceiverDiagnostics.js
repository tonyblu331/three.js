import * as THREE from 'three/webgpu';
import { normalWorld, positionWorld, vec3 } from 'three/tsl';

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
					samplePosition: receiver.samplePosition,
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
			const finalVisibleMaterialStudy = {
				status: 'OPEN-FINAL-VISIBLE-COLOR-MAPPING-PRESSURE',
				proofBoundary: 'Proof-6 unavailable final visible receiver audit; runtime visibility/debug nodes are inactive, so this section records an explicit OPEN diagnostic instead of touching runtime visibility state.',
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
				finalVisibleMaterialStudy,
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
				const weightTotal = pointSamples.reduce( ( total, sample ) => total + sample.quadratureWeight, 0 );
				const wrongRatio = pointSamples.reduce(
					( total, sample ) => total + sample.colorBias.wrongOverCorrect * sample.quadratureWeight,
					0
				) / Math.max( weightTotal, 0.0001 );
				const luminanceMean = pointSamples.reduce(
					( total, sample ) => total + sample.luminance * sample.quadratureWeight,
					0
				) / Math.max( weightTotal, 0.0001 );

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
				const weightTotal = pointSamples.reduce( ( total, sample ) => total + sample.quadratureWeight, 0 );
				const gpuWeightedMean = pointSamples.reduce(
					( total, sample ) => total + sample.gpuValue * sample.quadratureWeight,
					0
				) / Math.max( weightTotal, 0.0001 );
				const cpuWeightedMean = pointSamples.reduce(
					( total, sample ) => total + sample.cpuValue * sample.quadratureWeight,
					0
				) / Math.max( weightTotal, 0.0001 );

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
				const weightTotal = pointSamples.reduce( ( total, sample ) => total + sample.quadratureWeight, 0 );
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
				const weightedSampleDeltaMean = pointSamples.reduce(
					( total, sample ) => total + sample.linearRgbDelta.mean * sample.quadratureWeight,
					0
				) / Math.max( weightTotal, 0.0001 );
				const weightedSampleDeltaMax = pointSamples.reduce(
					( total, sample ) => total + sample.linearRgbDelta.max * sample.quadratureWeight,
					0
				) / Math.max( weightTotal, 0.0001 );

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


		const toneMappingName = ( value ) => {

			if ( value === THREE.NoToneMapping ) return 'NoToneMapping';
			if ( value === THREE.LinearToneMapping ) return 'LinearToneMapping';
			if ( value === THREE.ReinhardToneMapping ) return 'ReinhardToneMapping';
			if ( value === THREE.CineonToneMapping ) return 'CineonToneMapping';
			if ( value === THREE.ACESFilmicToneMapping ) return 'ACESFilmicToneMapping';

			return `toneMapping-${ value }`;

		};

		const colorSpaceName = value => value ?? 'unknown';

		const captureFinalVisibleMaterialStudy = async () => {

			const currentToneMapping = _lightProbeContext.renderer.toneMapping;
			const currentToneMappingExposure = _lightProbeContext.renderer.toneMappingExposure;
			const currentOutputColorSpace = _lightProbeContext.renderer.outputColorSpace;
			const currentVisibilityWeighting = _lightProbeContext.probeGrid.visibilityDepthWeighting.value;
			const currentLeftMaterial = previousLeftMaterial;
			const currentRightMaterial = previousRightMaterial;
			const receiverDiffuseColor = currentLeftMaterial.color?.clone?.() ?? new THREE.Color( 0xd8d2c5 );
			const debugMaterial = createDebugMaterial( {
				label: 'final-visible-debug-irradiance',
				debugRenderFamily: 'final-visible-audit',
				visibilityDepthWeighting: 1,
				debugScale: 0.25,
				node: 'manualIrradianceDebug',
				debugMode: 'finalIrradiance'
			} );
			const lambertDebugMaterial = createDebugMaterial( {
				label: 'final-visible-debug-lambert',
				debugRenderFamily: 'final-visible-audit',
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

			const captureOffscreenSceneLinearTarget = async ( options = {} ) => {

				const width = _lightProbeContext.renderer.domElement.width;
				const height = _lightProbeContext.renderer.domElement.height;
				const label = options.label ?? 'current-lighting';
				const receiverAlbedoMode = options.receiverAlbedoMode ?? 'original-receiver-albedo';
				const previousRenderTarget = _lightProbeContext.renderer.getRenderTarget();
				const previousToneMapping = _lightProbeContext.renderer.toneMapping;
				const previousToneMappingExposure = _lightProbeContext.renderer.toneMappingExposure;
				const previousOutputColorSpace = _lightProbeContext.renderer.outputColorSpace;
				const previousBackground = _lightProbeContext.scene.background;
				const previousLeftMaterial = _lightProbeContext.leakFixture.leftReceiver.material;
				const previousRightMaterial = _lightProbeContext.leakFixture.rightReceiver.material;
				const overrideLeftMaterial = options.receiverAlbedo !== undefined ? previousLeftMaterial.clone() : null;
				const overrideRightMaterial = options.receiverAlbedo !== undefined ? previousRightMaterial.clone() : null;
				const previousDirectLightIntensity = _lightProbeContext.directLight.intensity;
				const previousAmbientLightIntensity = _lightProbeContext.ambientLight.intensity;
				const previousProbeIntensity = _lightProbeContext.probeGrid.probeIntensity.value;
				const previousVisibilityWeighting = _lightProbeContext.probeGrid.visibilityDepthWeighting.value;
				const selectedLighting = {
					directIntensity: options.directIntensity ?? previousDirectLightIntensity,
					ambientIntensity: options.ambientIntensity ?? previousAmbientLightIntensity,
					probeIntensity: options.probeIntensity ?? previousProbeIntensity
				};
				const previousVisibility = [];
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
					if ( overrideLeftMaterial !== null ) {

						_lightProbeContext.leakFixture.leftReceiver.material = overrideLeftMaterial;
						_lightProbeContext.leakFixture.rightReceiver.material = overrideRightMaterial;

					}

					_lightProbeContext.renderer.setRenderTarget( colorTarget );
					_lightProbeContext.renderer.clear();
					_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );
					const colorData = await _lightProbeContext.renderer.readRenderTargetPixelsAsync( colorTarget, 0, 0, width, height );

					_lightProbeContext.scene.traverse( object => {

						if ( object.isMesh !== true ) return;

						previousVisibility.push( { object, visible: object.visible } );
						object.visible = object === _lightProbeContext.leakFixture.leftReceiver ||
									object === _lightProbeContext.leakFixture.rightReceiver;

					} );

					_lightProbeContext.scene.background = new THREE.Color( 0x000000 );
					_lightProbeContext.leakFixture.leftReceiver.material = leftMaskMaterial;
					_lightProbeContext.leakFixture.rightReceiver.material = rightMaskMaterial;
					_lightProbeContext.leakFixture.leftReceiver.visible = true;
					_lightProbeContext.leakFixture.rightReceiver.visible = true;

					_lightProbeContext.renderer.setRenderTarget( maskTarget );
					_lightProbeContext.renderer.clear();
					_lightProbeContext.renderer.render( _lightProbeContext.scene, _lightProbeContext.camera );
					const maskData = await _lightProbeContext.renderer.readRenderTargetPixelsAsync( maskTarget, 0, 0, width, height );
					const left = createReadbackReceiverMetric( colorData, maskData, width, height, THREE.HalfFloatType, 'left' );
					const right = createReadbackReceiverMetric( colorData, maskData, width, height, THREE.HalfFloatType, 'right' );
					const maskedWrongSideColorRatio = Math.max(
						left.colorBias.greenOverRed,
						right.colorBias.redOverGreen
					);
					const maskedCorrectBounceRatio = Math.min(
						left.colorBias.redOverGreen,
						right.colorBias.greenOverRed
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
						lighting: {
							directIntensity: roundMetric( selectedLighting.directIntensity ),
							ambientIntensity: roundMetric( selectedLighting.ambientIntensity ),
							probeIntensity: roundMetric( selectedLighting.probeIntensity )
						},
						size: { width, height },
						leftReceiverMasked: left,
						rightReceiverMasked: right,
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

					_lightProbeContext.leakFixture.leftReceiver.material = previousLeftMaterial;
					_lightProbeContext.leakFixture.rightReceiver.material = previousRightMaterial;
					_lightProbeContext.scene.background = previousBackground;

					for ( const state of previousVisibility ) {

						state.object.visible = state.visible;

					}

					_lightProbeContext.renderer.toneMapping = previousToneMapping;
					_lightProbeContext.renderer.toneMappingExposure = previousToneMappingExposure;
					_lightProbeContext.renderer.outputColorSpace = previousOutputColorSpace;
					_lightProbeContext.directLight.intensity = previousDirectLightIntensity;
					_lightProbeContext.ambientLight.intensity = previousAmbientLightIntensity;
					_lightProbeContext.probeGrid.probeIntensity.value = previousProbeIntensity;
					_lightProbeContext.probeGrid.visibilityDepthWeighting.value = previousVisibilityWeighting;
					_lightProbeContext.renderer.setRenderTarget( previousRenderTarget );
					leftMaskMaterial.dispose();
					rightMaskMaterial.dispose();
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
							'Contribution isolation did not produce enough masked receiver samples; keep the final-visible promotion gate open.' :
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
				const neutralVsOriginalProbeDelta = originalProbeRow !== null && neutralProbeRow !== null ?
					roundMetric( Math.abs( originalProbeRow.maskedWrongSideColorRatio - neutralProbeRow.maskedWrongSideColorRatio ) ) :
					null;
				const contributionGateWarnings = [];

				if ( neutralVsOriginalProbeDelta !== null && neutralVsOriginalProbeDelta <= 0.0001 ) {

					contributionGateWarnings.push( 'neutral receiver albedo row matches the original receiver row at current precision; the sealed-wall receiver material was already effectively neutral, so remaining chroma pressure comes from probe content / bounced-light chroma rather than receiver albedo.' );

				}

				const offscreenSceneLinearContributionGate = {
					status: offscreenSceneLinearContributionSummary.status === 'SUPPORTED' &&
								offscreenSceneLinearNeutralContributionSummary.status === 'SUPPORTED' &&
								neutralProbeRow !== null &&
								neutralProbeRow.maskedWrongSideColorRatio <= 1.15 &&
								neutralProbeRow.maskedCorrectBounceRatio >= 0.85 &&
								neutralProbeRow.chromaticityWrongSidePressure <= 0.05 ?
						'SUPPORTED' :
						'OPEN',
					mode: 'proof-only-offscreen-scene-linear-contribution-gate',
					thresholds: {
						neutralProbesOnlyWrongSideMax: 1.15,
						neutralProbesOnlyCorrectBounceMin: 0.85,
						neutralChromaticityWrongSidePressureMax: 0.05
					},
					neutralProbesOnly: neutralProbeRow === null ? null : {
						maskedWrongSideColorRatio: neutralProbeRow.maskedWrongSideColorRatio,
						maskedCorrectBounceRatio: neutralProbeRow.maskedCorrectBounceRatio,
						chromaticityWrongSidePressure: neutralProbeRow.chromaticityWrongSidePressure
					},
					neutralVsOriginalProbeDelta,
					warnings: contributionGateWarnings,
					diagnosticConclusion: neutralProbeRow === null ?
						'Neutral receiver probe-only row was not captured; keep promotion closed.' :
						'Contribution gate compares neutral receiver probe-only wrong-side/correct-bounce/chromaticity pressure against conservative proof thresholds; this remains report-only and does not promote public API.'
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
				const bsdfIntegrationSupported = lambertVsStandardLinearMaskedDelta <= 0.05;
				const materialAmplificationSuspected = bsdfIntegrationSupported === false;
				const toneMappingAmplificationSuspected = toneMappingMaskedDelta > 0.05 ||
							toneMappingSurfaceDelta > 0.05 ||
							outputColorSpaceMaskedDelta > 0.05 ||
							exposureMaskedDelta > 0.05;
				const status = materialAmplificationSuspected ?
					'OPEN-FINAL-VISIBLE-BSDF-PRESSURE' :
					toneMappingAmplificationSuspected ?
						'OPEN-FINAL-VISIBLE-COLOR-MAPPING-PRESSURE' :
						'SUPPORTED-FINAL-VISIBLE-PATH-BOUNDED';

				return {
					status,
					proofBoundary: 'Proof-only final visible receiver audit; compares original lit receiver material, renderer tone-mapping toggle, and MeshBasic final-irradiance debug output without changing runtime constants or public API.',
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
						lambertVsStandardLinearMaskedDelta,
						bsdfIntegrationSupported,
						materialAmplificationSuspected,
						toneMappingAmplificationSuspected,
						diagnosticConclusion: materialAmplificationSuspected ?
							'Final visible Lambert debug does not match the standard material linear-output path closely enough; inspect BSDF/light-node integration before tuning visibility thresholds.' :
							toneMappingAmplificationSuspected ?
								'Final visible Lambert debug matches the standard material linear-output path, so BSDF/lightsNode integration is bounded; visible wrong-side ratios are being reshaped mainly by tone mapping / output color-space.' :
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
				...irradianceVariants.map( captureVariant ),
				...irradianceTermVariants.map( captureVariant ),
				...weightVariants.map( captureVariant )
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
			const finalVisibleMaterialStudy = await captureFinalVisibleMaterialStudy();

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
				finalVisibleMaterialStudy,
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
					agreementMode: pointAgreementSupported ? 'tight-surface-point-samples' : 'open',
					comparableVariantCount: comparableVariants.length,
					linearIrradianceTermVariantCount: irradianceTermMetricVariants.length,
					weightTermVariantCount: weightTermVariants.length,
					whiteCalibrationLuminanceMean,
					whiteCalibrationVisible: whiteCalibrationLuminanceMean > 32,
					finalVisibleMaterialGate: finalVisibleMaterialStudy.status,
					finalVisibleMaterialDiagnosticConclusion: finalVisibleMaterialStudy.summary.diagnosticConclusion
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
