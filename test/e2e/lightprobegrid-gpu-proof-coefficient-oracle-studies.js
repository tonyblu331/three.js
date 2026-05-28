import { createLightProbeProofAggregateCoefficientOracleStudies } from './lightprobegrid-gpu-proof-aggregate-coefficient-oracle-studies.js';
import { createLightProbeProofProbe50CorrectionOracleStudies } from './lightprobegrid-gpu-proof-probe50-correction-oracle-studies.js';
import { createLightProbeProofProbe50L10OracleStudies } from './lightprobegrid-gpu-proof-probe50-l10-oracle-studies.js';

export const createLightProbeProofCoefficientOracleStudies = ( {
	surfaceContentAttributionSplitStudy,
	surfaceSampleCoefficientAttributionStudy
} ) => {

	const aggregateCoefficientOracleStudies = createLightProbeProofAggregateCoefficientOracleStudies( {
		surfaceContentAttributionSplitStudy
	} );
	const probe50L10OracleStudies = createLightProbeProofProbe50L10OracleStudies( {
		...aggregateCoefficientOracleStudies,
		surfaceSampleCoefficientAttributionStudy
	} );
	const probe50CorrectionOracleStudies = createLightProbeProofProbe50CorrectionOracleStudies( {
		...aggregateCoefficientOracleStudies,
		...probe50L10OracleStudies
	} );

	return {
		...aggregateCoefficientOracleStudies,
		...probe50L10OracleStudies,
		...probe50CorrectionOracleStudies
	};

};
