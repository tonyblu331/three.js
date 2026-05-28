import { histogramBy } from './lightprobegrid-gpu-report-metrics.js';

const isPlainFiniteHistogram = histogram =>
	histogram !== null &&
	Array.isArray( histogram ) === false &&
	typeof histogram === 'object' &&
	Object.values( histogram ).every( value => Number.isFinite( value ) );

const histogramSum = histogram =>
	Object.values( histogram ).reduce( ( sum, value ) => sum + value, 0 );

export const sameCountHistogram = ( actual, expected ) =>
	isPlainFiniteHistogram( actual ) &&
	Object.keys( actual ).length === Object.keys( expected ).length &&
	Object.entries( expected ).every( ( [ key, value ] ) => actual[ key ] === value );

export const sameCountHistogramBy = ( actual, rows, key ) =>
	sameCountHistogram( actual, histogramBy( rows, key ) );

export const isFiniteCountHistogram = ( histogram, expectedSum ) =>
	isPlainFiniteHistogram( histogram ) &&
	( expectedSum === 0 || Object.keys( histogram ).length > 0 ) &&
	Object.values( histogram ).every( value => Number.isInteger( value ) && value >= 0 ) &&
	histogramSum( histogram ) === expectedSum;

export const hasFiniteCountHistograms = ( row, keys, expectedSum ) =>
	keys.every( key => isFiniteCountHistogram( row[ key ], expectedSum ) );

export const hasUniqueExactIds = ( rows, ids ) =>
	Array.isArray( rows ) &&
	rows.length === ids.length &&
	new Set( rows.map( row => row.id ?? row.branch ) ).size === ids.length &&
	ids.every( id => rows.some( row => ( row.id ?? row.branch ) === id ) );

export const hasBatch = ( spec, id ) => spec.batches.some( batch => batch.id === id );

export const studyRows = study => Array.isArray( study?.rows ) ? study.rows : [];

const sameUniqueRowKeys = ( actualRows, expectedRows ) => {

	const actualKeys = actualRows.map( row => `${ row.receiver }/${ row.sampleLabel }` );
	const expectedKeys = expectedRows.map( row => `${ row.receiver }/${ row.sampleLabel }` );
	if ( new Set( actualKeys ).size !== actualKeys.length ) return false;
	if ( new Set( expectedKeys ).size !== expectedKeys.length ) return false;
	if ( actualKeys.length !== expectedKeys.length ) return false;
	const expectedKeySet = new Set( expectedKeys );
	return actualKeys.every( key => expectedKeySet.has( key ) );

};

export const matchesMappedBakeContentOracleRows = ( oracleRows, splitRows ) => {

	if ( oracleRows.length !== splitRows.length ) return false;
	if ( sameUniqueRowKeys( oracleRows, splitRows ) === false ) return false;

	const splitRowsBySample = new Map( splitRows.map( row => [ `${ row.receiver }/${ row.sampleLabel }`, row ] ) );
	return oracleRows.every( row => {

		const splitRow = splitRowsBySample.get( `${ row.receiver }/${ row.sampleLabel }` );
		return splitRow !== undefined &&
			row.mappedToContentPressure === splitRow.mappedToContentPressure &&
			row.contentProbeIndex === splitRow.contentDominantProbeIndex &&
			row.contentDominantBand === splitRow.contentDominantBand &&
			row.contentDominantPressure === splitRow.contentDominantPressure &&
			row.contentDominantWeightedPressure === splitRow.contentDominantWeightedPressure &&
			row.contentPressureAttributionRowCount === splitRow.contentPressureAttributionRowCount &&
			row.attributionProbeIndex === splitRow.attributionDominantProbeIndex &&
			row.attributionSourceProbeIndex === splitRow.attributionDominantSourceProbeIndex &&
			row.attributionProbeRelationToReceiver === splitRow.attributionProbeRelationToReceiver &&
			row.attributionSourceRelationToReceiver === splitRow.attributionSourceRelationToReceiver &&
			row.attributionSourceSide === splitRow.attributionSourceSide &&
			row.attributionDilationSourceDiffers === splitRow.attributionDilationSourceDiffers &&
			row.attributionSourceValidity === splitRow.attributionSourceValidity &&
			row.attributionRuntimeFinalWeight === splitRow.attributionRuntimeFinalWeight &&
			row.attributionDominantBand === splitRow.attributionDominantBand &&
			row.attributionDominantCoefficient === splitRow.attributionDominantCoefficient &&
			row.attributionDominantCoefficientBand === splitRow.attributionDominantCoefficientBand &&
			row.attributionDominantCoefficientWrongMinusCorrect === splitRow.attributionDominantCoefficientWrongMinusCorrect &&
			row.attributionWrongChannelPressure === splitRow.attributionWrongChannelPressure &&
			row.attributionCorrectChannelPreservation === splitRow.attributionCorrectChannelPreservation &&
			row.runtimeWrongOverCorrect === splitRow.runtimeWrongOverCorrect;

	} );

};

export const matchesUnmappedCoefficientInstrumentationRows = ( instrumentationRows, splitRows ) => {

	if ( instrumentationRows.length !== splitRows.length ) return false;
	if ( sameUniqueRowKeys( instrumentationRows, splitRows ) === false ) return false;

	const splitRowsBySample = new Map( splitRows.map( row => [ `${ row.receiver }/${ row.sampleLabel }`, row ] ) );
	return instrumentationRows.every( row => {

		const splitRow = splitRowsBySample.get( `${ row.receiver }/${ row.sampleLabel }` );
		return splitRow !== undefined &&
			row.mappedToContentPressure === splitRow.mappedToContentPressure &&
			row.contentProbeIndex === splitRow.contentDominantProbeIndex &&
			row.contentDominantBand === splitRow.contentDominantBand &&
			row.contentDominantPressure === splitRow.contentDominantPressure &&
			row.contentPressureAttributionRowCount === splitRow.contentPressureAttributionRowCount &&
			row.attributionProbeIndex === splitRow.attributionDominantProbeIndex &&
			row.attributionSourceProbeIndex === splitRow.attributionDominantSourceProbeIndex &&
			row.attributionProbeRelationToReceiver === splitRow.attributionProbeRelationToReceiver &&
			row.attributionSourceRelationToReceiver === splitRow.attributionSourceRelationToReceiver &&
			row.attributionSourceSide === splitRow.attributionSourceSide &&
			row.attributionDilationSourceDiffers === splitRow.attributionDilationSourceDiffers &&
			row.attributionSourceValidity === splitRow.attributionSourceValidity &&
			row.attributionRuntimeFinalWeight === splitRow.attributionRuntimeFinalWeight &&
			row.attributionDominantBand === splitRow.attributionDominantBand &&
			row.attributionDominantCoefficient === splitRow.attributionDominantCoefficient &&
			row.attributionDominantCoefficientBand === splitRow.attributionDominantCoefficientBand &&
			row.attributionDominantCoefficientWrongMinusCorrect === splitRow.attributionDominantCoefficientWrongMinusCorrect &&
			row.attributionDominantDilatedCoefficient === splitRow.attributionDominantDilatedCoefficient &&
			row.attributionDominantDilatedCoefficientBand === splitRow.attributionDominantDilatedCoefficientBand &&
			row.attributionDominantDilatedCoefficientWrongMinusCorrect === splitRow.attributionDominantDilatedCoefficientWrongMinusCorrect &&
			row.attributionWrongChannelPressure === splitRow.attributionWrongChannelPressure &&
			row.attributionCorrectChannelPreservation === splitRow.attributionCorrectChannelPreservation &&
			row.sourcePressureAttributionRowCount === splitRow.sourcePressureAttributionRowCount &&
			row.sourcePressureProbeIndex === splitRow.sourcePressureProbeIndex &&
			row.sourcePressureSourceProbeIndex === splitRow.sourcePressureSourceProbeIndex &&
			row.sourcePressureWrongChannelPressure === splitRow.sourcePressureWrongChannelPressure &&
			row.sourcePressureDilatedWrongChannelPressure === splitRow.sourcePressureDilatedWrongChannelPressure &&
			row.sourcePressureDilatedSourceWrongPressureDelta === splitRow.sourcePressureDilatedSourceWrongPressureDelta &&
			row.runtimeWrongOverCorrect === splitRow.runtimeWrongOverCorrect;

	} );

};
