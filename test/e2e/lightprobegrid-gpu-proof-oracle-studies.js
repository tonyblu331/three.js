import { createLightProbeProofBranchOracleStudies } from './lightprobegrid-gpu-proof-branch-oracle-studies.js';
import { createLightProbeProofCoefficientOracleStudies } from './lightprobegrid-gpu-proof-coefficient-oracle-studies.js';

export const createLightProbeProofOracleStudies = ( {
	surfaceContentAttributionSplitStudy,
	surfaceContentAttributionFollowupStudy,
	surfaceSampleCoefficientAttributionStudy,
	sdfStaticBlockerOracleStudy
} ) => {

	const coefficientOracleStudies = createLightProbeProofCoefficientOracleStudies( {
		surfaceContentAttributionSplitStudy,
		surfaceSampleCoefficientAttributionStudy
	} );
	const branchOracleStudies = createLightProbeProofBranchOracleStudies( {
		surfaceContentAttributionFollowupStudy,
		surfaceSampleCoefficientAttributionStudy,
		sdfStaticBlockerOracleStudy
	} );

	return {
		...coefficientOracleStudies,
		...branchOracleStudies
	};

};
