import { appendLightProbeProofProbeDiagnosticsMarkdown } from './lightprobegrid-gpu-proof-probe-markdown.js';
import { appendLightProbeProofProgramMarkdown } from './lightprobegrid-gpu-proof-program-markdown.js';
import { appendLightProbeProofReceiverDiagnosticsMarkdown } from './lightprobegrid-gpu-proof-receiver-markdown.js';

export function appendLightProbeProofDiagnosticMarkdown( lines, report ) {

	appendLightProbeProofProgramMarkdown( lines, report );
	appendLightProbeProofProbeDiagnosticsMarkdown( lines, report );
	appendLightProbeProofReceiverDiagnosticsMarkdown( lines, report );

}
