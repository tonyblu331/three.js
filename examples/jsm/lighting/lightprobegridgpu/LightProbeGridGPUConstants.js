export const SH_COEFFICIENTS = 9;
export const PACKED_SH_TEXTURES = 7;
export const ATLAS_PADDING = 1;
export const PROBE_VALIDITY_FLOOR = 0.05;
export const VISIBILITY_DEPTH_RESOLUTION = 8;
export const VISIBILITY_DEPTH_MAX_DISTANCE = 20;
export const VISIBILITY_MIN_VARIANCE = 0.0004;
export const VISIBILITY_DISTANCE_BIAS = 0.02;
export const DEFAULT_PROBE_LAYER_MASK = 1;

export const BACKEND_LABELS = {
	projection: 'fragment',
	atlas: 'render-pass',
	update: 'full'
};

export const PACKED_SH_COEFFICIENT_LAYOUT = [
	[
		{ coefficient: 0, component: 'r' },
		{ coefficient: 0, component: 'g' },
		{ coefficient: 0, component: 'b' },
		{ coefficient: 1, component: 'r' }
	],
	[
		{ coefficient: 1, component: 'g' },
		{ coefficient: 1, component: 'b' },
		{ coefficient: 2, component: 'r' },
		{ coefficient: 2, component: 'g' }
	],
	[
		{ coefficient: 2, component: 'b' },
		{ coefficient: 3, component: 'r' },
		{ coefficient: 3, component: 'g' },
		{ coefficient: 3, component: 'b' }
	],
	[
		{ coefficient: 4, component: 'r' },
		{ coefficient: 4, component: 'g' },
		{ coefficient: 4, component: 'b' },
		{ coefficient: 5, component: 'r' }
	],
	[
		{ coefficient: 5, component: 'g' },
		{ coefficient: 5, component: 'b' },
		{ coefficient: 6, component: 'r' },
		{ coefficient: 6, component: 'g' }
	],
	[
		{ coefficient: 6, component: 'b' },
		{ coefficient: 7, component: 'r' },
		{ coefficient: 7, component: 'g' },
		{ coefficient: 7, component: 'b' }
	],
	[
		{ coefficient: 8, component: 'r' },
		{ coefficient: 8, component: 'g' },
		{ coefficient: 8, component: 'b' },
		{ value: 'validity' }
	]
];
