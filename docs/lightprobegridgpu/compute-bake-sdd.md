# Compute Bake Pipeline SDD (Phase A)

## Overview

Implement GPU-accelerated spherical harmonics projection using WebGPU compute shaders. Replace the current fragment shader-based projection (which renders 9 coefficients separately) with a single compute pass that projects all SH coefficients in parallel.

## Goals

1. **Performance**: 5-10× faster SH projection compared to fragment shader approach
2. **Quality**: Identical output to fragment shader (bit-exact or within floating point tolerance)
3. **Compatibility**: Work on all WebGPU-capable browsers
4. **Fallback**: Gracefully degrade to fragment shader if compute unavailable

## Non-Goals

- Compute-based cubemap capture (keep using CubeCamera)
- Compute-based atlas packing (keep using fragment shaders)
- Support for WebGL (WebGPU only)

## Current Implementation (Fragment Shader)

### Bottleneck Analysis

The current fragment shader approach:
1. Captures 6-face cubemap for each probe (GPU → texture)
2. For each of 9 SH coefficients:
   - Renders full-screen quad with fragment shader
   - Fragment shader samples cubemap and computes SH basis
   - Writes result to coefficient texture (9×N resolution)
3. Total: 9 draw calls per probe, 9×N×6 cubemap samples

**Performance**: ~200ms for 64 probes at 8×8 cubemap resolution

### Why Compute is Better

1. **Parallelism**: Process all coefficients in single pass
2. **Shared memory**: Load cubemap once, reuse across coefficients
3. **No render targets**: Write directly to storage texture
4. **Reduced overhead**: 1 dispatch vs 9 draw calls

## Requirements

### Functional Requirements

1. **SH Projection**: Compute L2 spherical harmonics (9 coefficients) from cubemap
   - Input: 6-face cubemap texture (RGBA16Float or RGBA32Float)
   - Output: 9×N coefficient texture (same format as current)
   - Quality: Match fragment shader output within 0.1% tolerance

2. **Workgroup Organization**:
   - Each workgroup processes one probe
   - Workgroup size: 64 threads (8×8, matching cubemap face resolution)
   - Use shared memory to cache cubemap samples

3. **Integration**:
   - Called from `_bake()` method after cubemap capture
   - Replace `_runFragmentCoefficientProjection()` with `_runComputeProjection()`
   - Maintain same output format for atlas packing

4. **Fallback**:
   - Detect WebGPU compute support at initialization
   - Fall back to fragment shader if compute unavailable
   - Log warning when fallback is used

### Non-Functional Requirements

1. **Performance**: <50ms for 64 probes at 8×8 cubemap (4× speedup minimum)
2. **Memory**: No additional texture allocations (reuse existing)
3. **Compatibility**: WebGPU compute shaders (WGSL)

## API Design

### New Methods

```javascript
/**
 * Runs compute-based SH projection for a single probe.
 * Replaces _runFragmentCoefficientProjection() when compute is available.
 * 
 * @param {number} probeIndex - Index of probe to project
 */
_runComputeProjection( probeIndex ) {
    // Dispatch compute shader
    // Write results to coefficientTarget
}

/**
 * Initializes compute pipeline and resources.
 * Called from _createResources() if compute is supported.
 */
_createComputeResources() {
    // Create compute pipeline
    // Create bind group layout
    // Create storage texture views
}

/**
 * Checks if compute-based projection is available.
 * @returns {boolean}
 */
_canUseComputeProjection() {
    return this.renderer.capabilities.isWebGPU && 
           this.computePipeline !== null;
}
```

### New Properties

```javascript
this.computePipeline = null;        // WebGPU compute pipeline
this.computeBindGroup = null;       // Bind group for compute shader
this.computeWorkgroupSize = 64;     // Threads per workgroup
this.useComputeProjection = false;  // Runtime flag
```

### Compute Shader Interface

```wgsl
@group(0) @binding(0) var cubemapTexture: texture_2d_array<f32>;
@group(0) @binding(1) var coefficientTexture: texture_storage_2d<rgba16float, write>;

@group(1) @binding(0) var<uniform> probeIndex: u32;
@group(1) @binding(1) var<uniform> cubemapSize: u32;

var<workgroup> sharedCubemapSamples: array<vec4<f32>, 384>;  // 6 faces × 64 texels

@compute @workgroup_size(8, 8, 1)
fn main(
    @builtin(local_invocation_id) localID: vec3<u32>,
    @builtin(workgroup_id) workgroupID: vec3<u32>
) {
    // Implementation
}
```

## Implementation Approach

### Compute Shader Algorithm

```wgsl
// Step 1: Load cubemap samples into shared memory
let faceIndex = localID.y;  // 0-5 for 6 faces
let texelIndex = localID.x; // 0-63 for 8×8 face

if (faceIndex < 6u) {
    let uv = vec2<f32>(
        (f32(texelIndex % 8u) + 0.5) / f32(cubemapSize),
        (f32(texelIndex / 8u) + 0.5) / f32(cubemapSize)
    );
    sharedCubemapSamples[faceIndex * 64u + texelIndex] = 
        textureSampleLevel(cubemapTexture, sampler, uv, faceIndex, 0.0);
}

workgroupBarrier();

// Step 2: Compute SH coefficients (all 9 in parallel)
if (texelIndex < 9u) {
    var sh = vec3<f32>(0.0);
    
    for (var face = 0u; face < 6u; face++) {
        for (var i = 0u; i < 64u; i++) {
            let sample = sharedCubemapSamples[face * 64u + i];
            let direction = cubemapTexelToDirection(face, i);
            let weight = solidAngleWeight(direction);
            let basis = shBasis(texelIndex, direction);
            
            sh += sample.rgb * weight * basis;
        }
    }
    
    // Normalize
    sh *= 4.0 * PI / f32(6 * 64);
    
    // Write to output texture
    textureStore(coefficientTexture, vec2<i32>(i32(texelIndex), i32(probeIndex)), vec4<f32>(sh, 1.0));
}
```

### Host-Side Integration

```javascript
_runComputeProjection( probeIndex ) {
    // Update uniform buffer with probe index
    this.probeIndexUniformBuffer.write( new Uint32Array([ probeIndex ]) );
    
    // Dispatch compute shader
    const commandEncoder = this.renderer.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    
    passEncoder.setPipeline( this.computePipeline );
    passEncoder.setBindGroup( 0, this.cubemapBindGroup );
    passEncoder.setBindGroup( 1, this.probeBindGroup );
    passEncoder.dispatchWorkgroups( 1, 1, 1 );
    
    passEncoder.end();
    this.renderer.queue.submit([ commandEncoder.finish() ]);
}
```

### Fallback Strategy

```javascript
_bake( scene, options ) {
    // ... cubemap capture ...
    
    if ( this._canUseComputeProjection() ) {
        this._runComputeProjection( probeIndex );
    } else {
        this._runFragmentCoefficientProjection( probeIndex );
    }
    
    // ... rest of bake ...
}
```

## Testing Strategy

### Unit Tests

1. **Correctness**: Compare compute output to fragment shader output
   - Test with simple cubemap (solid color)
   - Test with gradient cubemap
   - Test with high-frequency cubemap
   - Tolerance: <0.1% difference per coefficient

2. **Edge cases**:
   - Cubemap size != 8×8 (should still work)
   - Probe at grid boundary
   - Invalid cubemap (NaN, infinity)

3. **Fallback**:
   - Test with compute disabled → uses fragment shader
   - Test with WebGPU unavailable → uses fragment shader

### Integration Tests

1. **Cornell box bake**:
   - Bake with compute → verify lighting looks correct
   - Compare to fragment shader bake → should be identical
   
2. **Performance test**:
   - Bake 64 probes with compute → <50ms
   - Bake 64 probes with fragment → ~200ms
   - Verify 4× speedup

### Visual Tests

1. **Side-by-side comparison**:
   - Render scene with compute-baked probes
   - Render scene with fragment-baked probes
   - Should be visually identical

## Performance Analysis

### Expected Speedup

**Current (Fragment)**:
- 9 draw calls per probe
- 9×6×64 = 3,456 texture samples per probe
- GPU overhead: ~3ms per draw call
- Total: ~200ms for 64 probes

**Compute**:
- 1 dispatch per probe
- 6×64 = 384 texture samples per probe (shared memory)
- GPU overhead: ~0.5ms per dispatch
- Total: ~50ms for 64 probes

**Speedup**: 4× (meets minimum requirement)

### Memory Bandwidth

**Fragment**:
- Read cubemap: 9× per coefficient
- Write coefficients: 9× per probe
- Total: High bandwidth usage

**Compute**:
- Read cubemap: 1× into shared memory
- Write coefficients: 1× per probe
- Total: 9× less bandwidth

## Edge Cases

1. **Non-power-of-2 cubemap size**:
   - Workgroup size must match cubemap face size
   - If size != 8, adjust workgroup size dynamically
   - Fallback to fragment shader if size > 16

2. **Compute shader compilation failure**:
   - Catch compilation errors
   - Fall back to fragment shader
   - Log detailed error message

3. **Shared memory limits**:
   - Max shared memory per workgroup: 16KB (WebGPU)
   - 384 vec4<f32> = 6KB (within limit)
   - No issues expected

4. **Multiple probes in flight**:
   - Current implementation: sequential (one probe at a time)
   - Future: batch multiple probes per dispatch

## Future Enhancements

1. **Batched projection**: Process multiple probes per dispatch
2. **Compute-based cubemap capture**: Replace CubeCamera with compute
3. **Async compute**: Overlap cubemap capture with SH projection
4. **Adaptive quality**: Reduce workgroup size for distant probes

## Success Criteria

1. Compute projection produces identical results to fragment shader
2. 4× speedup minimum for typical bake scenarios
3. Graceful fallback to fragment shader when compute unavailable
4. No regressions in existing test cases
5. Clean integration with existing bake pipeline

## Timeline Estimate

- WGSL shader development: 2 days
- Host-side integration: 1 day
- Testing and validation: 1 day
- Fallback implementation: 0.5 days
- Documentation: 0.5 days
- **Total: 5 days**

## Dependencies

- WebGPU compute shader support (available in Chrome, Edge, Firefox)
- Existing cubemap capture system (CubeCamera)
- Existing coefficient texture format (9×N RGBA16Float)

## Risks

1. **Numerical differences**: Compute vs fragment may produce slightly different results
   - Mitigation: Use same SH basis functions, validate within tolerance
   
2. **Browser compatibility**: WebGPU not available in all browsers
   - Mitigation: Robust fallback to fragment shader
   
3. **Performance regression**: Compute may be slower on some GPUs
   - Mitigation: Benchmark on multiple GPUs, add performance test
   
4. **Shader compilation time**: WGSL compilation may add overhead
   - Mitigation: Compile pipeline once at initialization, reuse

## Migration Path

1. **Phase 1**: Implement compute shader with manual toggle
2. **Phase 2**: Add automatic detection and fallback
3. **Phase 3**: Make compute default, fragment as fallback
4. **Phase 4**: Deprecate fragment shader (if compute widely supported)
