# LightProbeGridGPU Documentation

## Overview

`LightProbeGridGPU` is a GPU-accelerated light probe grid implementation for three.js. It captures and stores spherical harmonics (SH) irradiance data at discrete probe positions in 3D space, enabling efficient global illumination for real-time rendering.

## Architecture

### Core Components

- **LightProbeGridGPU** (`LightProbeGridGPU.js`, 1,181 lines): Main class that manages probe grid, baking, and irradiance sampling
- **LightProbeGridGPUMetadata** (`lightprobegridgpu/LightProbeGridGPUMetadata.js`, 96 lines): Probe validity and layer mask validation
- **LightProbeGridGPUDebug** (`LightProbeGridGPUDebug.js`, 373 lines): Debug visualization and analysis tools (optional)
- **LightProbeGridGPUAtlas** (`lightprobegridgpu/LightProbeGridGPUAtlas.js`, 128 lines): Atlas packing and coordinate calculations
- **LightProbeGridGPUConstants** (`lightprobegridgpu/LightProbeGridGPUConstants.js`, 65 lines): Constants and configuration
- **LightProbeGridGPUProjection** (`lightprobegridgpu/LightProbeGridGPUProjection.js`, 157 lines): SH projection from cubemaps
- **LightProbeGridGPUVisibility** (`lightprobegridgpu/LightProbeGridGPUVisibility.js`, 375 lines): Visibility and occlusion system

### Data Flow

```
Scene → CubeCamera (6-face capture) → SH Projection (9 coefficients) → Coefficient Texture → Atlas Packing → 3D Atlas Texture
                                                                                                                ↓
                                                                                                    Irradiance Sampling (runtime)
```

## Usage

### Basic Setup

```javascript
import { LightProbeGridGPU } from 'three/addons/lighting/LightProbeGridGPU.js';

// Create probe grid
const probeGrid = new LightProbeGridGPU(
    new THREE.Vector3(-5, -5, -5),  // min bounds
    new THREE.Vector3(5, 5, 5),     // max bounds
    {
        resolution: 8,              // probes per axis (8³ = 512 probes)
        intensity: 1.0,
        normalBias: 0.2,
        viewBias: 0.2
    }
);

// Add to scene
scene.add(probeGrid);

// Bake irradiance (async)
await probeGrid.bake(renderer, scene);
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `resolution` | `number` | `4` | Number of probes per axis (total = resolution³) |
| `cubemapSize` | `number` | `256` | Resolution of cubemap faces for SH projection |
| `intensity` | `number` | `1.0` | Global intensity multiplier for sampled irradiance |
| `normalBias` | `number` | `0.2` | Bias along surface normal (in probe spacing units) |
| `viewBias` | `number` | `0.2` | Bias along view direction (in probe spacing units) |
| `leakReductionMode` | `string` | `'off'` | Leak reduction strategy (`'off'`, `'simple'`, `'advanced'`) |
| `enableVisibility` | `boolean` | `false` | Enable visibility/occlusion system |
| `probeValidity` | `ArrayLike<number>` | `null` | Per-probe validity values (0-1) |
| `probeLayerMasks` | `ArrayLike<number>` | `null` | Per-probe layer masks for selective lighting |

### Baking

The `bake()` method captures irradiance from the scene and stores it in the probe grid:

```javascript
await probeGrid.bake(renderer, scene, {
    // Optional bake options
    onProgress: (progress) => console.log(`${progress}% complete`)
});
```

**What happens during bake:**
1. For each probe position:
   - Position CubeCamera at probe location
   - Render 6-face cubemap of scene
   - Project cubemap to 9 SH coefficients (L2 spherical harmonics)
   - Store coefficients in temporary texture
2. Pack all probe coefficients into 3D atlas texture
3. (Optional) Compute visibility data if enabled

**Performance:** ~200ms for 64 probes at 256×256 cubemap resolution (fragment shader path)

### Sampling Irradiance

Create an irradiance node for use in materials:

```javascript
const irradianceNode = probeGrid.createIrradianceNode({
    receiverLayerMask: 1,
    receiverBoundaryLayerMask: 1,
    receiverBoundaryWeight: 0.0
});

// Use in custom shader material
material.colorNode = irradianceNode;
```

Or use the convenience method to add to existing lights:

```javascript
const lightsNode = probeGrid.createLightsNode([directLight, ambientLight]);
material.lightsNode = lightsNode;
```

### Sampling Modes

**Fast Mode** (default, `leakReductionMode: 'off'`):
- Hardware trilinear filtering on atlas texture
- Fastest performance, suitable for most scenes
- May exhibit light leaking through thin geometry

**Guarded Mode** (`leakReductionMode: 'advanced'`):
- Manual trilinear interpolation with visibility weighting
- Prevents light leaking through walls
- ~2× slower than fast mode
- Requires `enableVisibility: true`

### Probe Validity

Control which probes contribute to lighting:

```javascript
// Mark probes inside geometry as invalid
const validity = new Float32Array(64);
for (let i = 0; i < 64; i++) {
    validity[i] = isProbeInsideGeometry(i) ? 0.0 : 1.0;
}

const probeGrid = new LightProbeGridGPU(min, max, {
    resolution: 4,
    probeValidity: validity
});
```

Invalid probes (validity < 1.0) are skipped during bake, saving performance and preventing incorrect lighting.

### Layer Masks

Use layer masks for selective lighting (e.g., separate lighting for different rooms):

```javascript
const layerMasks = new Uint32Array(64);
// Assign probes to different layers
layerMasks[0] = 0b0001;  // Layer 1
layerMasks[1] = 0b0010;  // Layer 2

const probeGrid = new LightProbeGridGPU(min, max, {
    probeLayerMasks: layerMasks
});

// Sample only from layer 1
const irradianceNode = probeGrid.createIrradianceNode({
    receiverLayerMask: 0b0001
});
```

## API Reference

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `intensity` | `Uniform<number>` | Global intensity multiplier |
| `normalBias` | `Uniform<number>` | Normal bias in probe spacing units |
| `viewBias` | `Uniform<number>` | View bias in probe spacing units |
| `texture` | `Texture3D` | 3D atlas texture containing SH coefficients |
| `boundingBox` | `Box3` | World-space bounding box of probe grid |
| `resolution` | `Vector3` | Number of probes per axis |
| `totalProbes` | `number` | Total number of probes (resolution.x × resolution.y × resolution.z) |

### Methods

#### `constructor(min, max, options)`

Creates a new probe grid.

**Parameters:**
- `min` (`Vector3`): Minimum bounds of probe grid
- `max` (`Vector3`): Maximum bounds of probe grid
- `options` (`Object`): Configuration options (see table above)

#### `bake(renderer, scene, options)`

Bakes irradiance data from scene.

**Parameters:**
- `renderer` (`WebGPURenderer`): Renderer instance
- `scene` (`Scene`): Scene to bake
- `options` (`Object`): Optional bake configuration

**Returns:** `Promise<void>`

#### `createIrradianceNode(options)`

Creates a TSL node for sampling irradiance.

**Parameters:**
- `options` (`Object`): Sampling configuration
  - `receiverLayerMask` (`number`): Layer mask for receiver
  - `receiverBoundaryLayerMask` (`number`): Boundary layer mask
  - `receiverBoundaryWeight` (`number`): Boundary weight (0-1)

**Returns:** `Node` - TSL irradiance node

#### `createLightsNode(lights, options)`

Creates a lights node combining direct lights with probe irradiance.

**Parameters:**
- `lights` (`Array<Light>`): Direct lights to include
- `options` (`Object`): Sampling options (same as `createIrradianceNode`)

**Returns:** `Node` - TSL lights node

#### `createHelper()`

Creates a visual helper showing probe positions and validity.

**Returns:** `InstancedMesh` - Helper mesh (add to scene for visualization)

#### `getProbePosition(index, target)`

Gets world-space position of a probe.

**Parameters:**
- `index` (`number`): Probe index (0 to totalProbes-1)
- `target` (`Vector3`): Target vector to store position

#### `getSamplingInfo()`

Returns current sampling configuration.

**Returns:** `Object` with quality, bias, and visibility settings

#### `getMemoryInfo()`

Returns memory usage statistics.

**Returns:** `Object` with texture sizes and total memory usage

#### `setOptions(options, renderer)`

Updates configuration options.

**Parameters:**
- `options` (`Object`): New configuration
- `renderer` (`WebGPURenderer`): Renderer instance (required if changing resolution)

#### `dispose()`

Frees all GPU resources.

## Debug Tools

The optional `LightProbeGridGPUDebug` module provides visualization and analysis tools:

```javascript
import { createManualIrradianceDebugNode } from 'three/addons/lighting/LightProbeGridGPUDebug.js';

// Visualize trilinear weights
const debugNode = createManualIrradianceDebugNode(
    probeGrid,
    'trilinearBlend',  // Debug mode
    {}
);

material.colorNode = debugNode;
```

**Available debug modes:**
- `'finalIrradiance'`: Final computed irradiance (default)
- `'trilinearBlend'`: Trilinear interpolation weights
- `'visibilityWeight'`: Visibility weighting
- `'scalarIrradiance'`: Irradiance before visibility
- `'visibilityIrradiance'`: Irradiance after visibility
- `'neighbor0TrilinearWeight'` to `'neighbor7TrilinearWeight'`: Per-neighbor weights
- `'neighbor0ValidityWeight'` to `'neighbor7ValidityWeight'`: Per-neighbor validity
- And many more (see source for full list)

## Performance Tips

1. **Start with low resolution**: Begin with `resolution: 4` (64 probes) and increase as needed
2. **Use validity data**: Mark probes inside geometry as invalid to skip unnecessary bakes
3. **Prefer fast mode**: Use `leakReductionMode: 'off'` unless you have light leaking issues
4. **Bake once**: Bake irradiance once at scene load, not every frame
5. **Reduce cubemap size**: Use `cubemapSize: 128` for faster bakes (slightly lower quality)

## Known Limitations

1. **Static scenes**: Probe grid must be re-baked when scene geometry changes
2. **No dynamic lighting**: Only captures static lighting (use with direct lights for dynamic objects)
3. **WebGPU only**: Requires WebGPU-capable browser (no WebGL fallback)
4. **Memory usage**: Each probe requires ~144 bytes (9 coefficients × 4 channels × 4 bytes)

## Examples

See `examples/webgpu_lightprobes_cornell.html` for a complete working example.

## Design Documents

- [Probe Relocation SDD](./probe-relocation-sdd.md): Design for automatic probe relocation (Phase D2)
- [Compute Bake SDD](./compute-bake-sdd.md): Design for GPU compute shader baking (Phase A)

## Migration Guide

### From v1 to v2 (Current)

**Breaking Changes:**
- `probeIntensity` renamed to `intensity`
- `visibilityBias` renamed to `selfShadowBias`
- Removed `band1Intensity` and `band2Intensity` (use debug module if needed)
- Removed `_probeKernelData` and related methods
- Simplified `getSamplingInfo()` (fewer fields)

**Migration:**
```javascript
// Before (v1)
probeGrid.probeIntensity.value = 2.0;

// After (v2)
probeGrid.intensity.value = 2.0;
```

## Troubleshooting

### Black spots in lighting
- **Cause**: Probes inside geometry with validity=1
- **Solution**: Set `probeValidity[i] = 0` for probes inside geometry

### Light leaking through walls
- **Cause**: Fast sampling mode doesn't check visibility
- **Solution**: Use `leakReductionMode: 'advanced'` and `enableVisibility: true`

### Slow bake performance
- **Cause**: Too many probes or high cubemap resolution
- **Solution**: Reduce `resolution` or `cubemapSize`

### No lighting visible
- **Cause**: Irradiance node not added to material
- **Solution**: Ensure `material.lightsNode` or `material.colorNode` includes probe irradiance

## Contributing

This implementation is part of the three.js WebGPU initiative. See the main three.js repository for contribution guidelines.

## License

MIT License (same as three.js)
