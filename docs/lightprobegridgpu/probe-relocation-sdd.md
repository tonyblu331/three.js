# Probe Relocation SDD (Phase D2)

## Overview

Implement automatic probe relocation for probes that are positioned inside solid geometry. Instead of skipping these probes (current Phase D1 behavior), relocate them to nearby valid positions before capturing their irradiance data.

## Goals

1. **Quality Improvement**: Prevent black/invalid probes from appearing in the final lightmap
2. **Automatic**: No manual intervention required from users
3. **Performance**: Minimal overhead during bake time (<10% increase)
4. **Predictable**: Deterministic relocation behavior

## Non-Goals

- Dynamic probe relocation at runtime (bake-time only)
- User-configurable relocation strategies (use sensible defaults)
- Relocation across grid boundaries

## Requirements

### Functional Requirements

1. **Detection**: Identify probes positioned inside solid geometry
   - Use raycasting in 6 directions (+X, -X, +Y, -Y, +Z, -Z)
   - If ≥5 rays hit geometry within probe spacing distance → probe is inside
   - Alternative: Check if probe validity is 0 (user-provided)

2. **Relocation Strategy**: Find nearest valid position
   - Search in expanding spherical shells around original position
   - Maximum search radius: 2× probe spacing
   - Prefer positions that maintain grid structure (snap to grid if possible)
   - Validate candidate position is not inside geometry

3. **Fallback Behavior**:
   - If no valid position found within search radius → keep original position with validity=0
   - Log warning for debugging

4. **Integration**:
   - Happens during `_bake()` before cubemap capture
   - Store relocation mapping for debugging/visualization
   - Update probe positions in grid data structure

### Non-Functional Requirements

1. **Performance**: Relocation pass should complete in <500ms for 1000 probes
2. **Memory**: Temporary storage for relocation mapping (<1KB per probe)
3. **Determinism**: Same input → same relocation results

## API Design

### New Methods

```javascript
/**
 * Relocates probes that are inside geometry to nearby valid positions.
 * Called automatically during bake if options.relocateInvalidProbes is true.
 * 
 * @param {THREE.Scene} scene - Scene containing geometry
 * @returns {{ relocatedCount: number, mapping: Map<number, THREE.Vector3> }}
 */
_relocateInvalidProbes( scene ) {
    // Implementation
}

/**
 * Checks if a position is inside solid geometry using raycasting.
 * 
 * @param {THREE.Vector3} position - Position to check
 * @param {THREE.Scene} scene - Scene containing geometry
 * @param {number} maxDistance - Maximum raycast distance
 * @returns {boolean} True if position is inside geometry
 */
_isPositionInsideGeometry( position, scene, maxDistance ) {
    // Implementation
}
```

### New Options

```javascript
// In constructor/bake options:
{
    relocateInvalidProbes: true,        // Enable automatic relocation
    relocationMaxDistance: 2.0,         // Max search distance in probe spacings
    relocationRayDirections: 6          // Number of rays to cast (6 or 26)
}
```

### New Properties

```javascript
this.relocationMapping = new Map();  // probeIndex → relocatedPosition
this.relocatedProbeCount = 0;
```

## Implementation Approach

### Algorithm

```
For each probe with validity === 0:
  1. Cast 6 rays from probe position
  2. Count hits within probe spacing distance
  3. If ≥5 hits → probe is inside geometry
  
  4. Search for valid position:
     - Generate candidate positions in expanding shells
     - For each candidate:
       - Check if inside geometry (raycast)
       - If valid, select this position
       - If no valid position found in shell, expand radius
     
  5. If valid position found:
     - Update probe position in grid
     - Store in relocationMapping
     - Set validity to 1.0
  
  6. If no valid position found:
     - Keep original position
     - Keep validity at 0.0
     - Log warning
```

### Data Structures

```javascript
// Relocation mapping
this.relocationMapping = new Map();
// Key: original probe index
// Value: { originalPosition: Vector3, relocatedPosition: Vector3 }

// Temporary raycaster
this._relocationRaycaster = new THREE.Raycaster();
this._relocationRaycaster.far = probeSpacing * 2;
```

### Integration Points

1. **In `_bake()` method**:
   ```javascript
   // After creating probeValidityTexture
   if ( options.relocateInvalidProbes ) {
       const relocationResult = this._relocateInvalidProbes( scene );
       console.log(`Relocated ${relocationResult.relocatedCount} probes`);
   }
   ```

2. **In `getProbePosition()`**:
   ```javascript
   getProbePosition( index, target ) {
       // Check if probe was relocated
       if ( this.relocationMapping.has( index ) ) {
           target.copy( this.relocationMapping.get( index ).relocatedPosition );
           return;
       }
       
       // Original logic
       // ...
   }
   ```

## Testing Strategy

### Unit Tests

1. **Detection accuracy**:
   - Test probe inside box geometry → detected as inside
   - Test probe outside geometry → detected as outside
   - Test probe on surface → detected as outside

2. **Relocation correctness**:
   - Test probe inside box → relocated to nearest valid position
   - Test probe with no valid neighbors → stays invalid
   - Test probe with valid neighbor at max distance → relocated

3. **Edge cases**:
   - All probes invalid → graceful degradation
   - Probe at grid boundary → stays within bounds
   - Multiple probes competing for same position → deterministic selection

### Integration Tests

1. **Cornell box scenario**:
   - Probes inside tall box → relocated outside
   - Probes inside short box → relocated outside
   - Visual verification: no black spots in final render

2. **Performance test**:
   - 1000 probes with 100 invalid → <500ms relocation time
   - Memory usage stays within bounds

### Visual Tests

1. **Before/after comparison**:
   - Render Cornell box without relocation (black spots visible)
   - Render Cornell box with relocation (smooth lighting)
   - Screenshot comparison

## Edge Cases

1. **Probe at grid boundary**:
   - Don't relocate outside grid bounds
   - If no valid position within bounds, keep original

2. **Multiple probes competing for same position**:
   - First probe wins (deterministic order)
   - Subsequent probes search for next valid position

3. **Probe near thin geometry**:
   - May not detect as "inside" due to ray precision
   - Acceptable: will have reduced validity from partial occlusion

4. **Dynamic geometry**:
   - Only relocate based on geometry at bake time
   - Runtime geometry changes not handled

## Performance Considerations

### Optimization Strategies

1. **Early exit**: Stop raycasting once ≥5 hits detected
2. **Spatial caching**: Cache raycast results for nearby positions
3. **Batch processing**: Process multiple probes in parallel (future)
4. **Adaptive search**: Start with small radius, expand only if needed

### Memory Usage

- Relocation mapping: ~100 bytes per relocated probe
- For 1000 probes with 100 relocated: ~10KB
- Negligible impact on overall memory budget

## Future Enhancements

1. **User-provided relocation hints**: Allow users to specify preferred relocation directions
2. **Weighted relocation**: Prefer positions with better visibility coverage
3. **Multi-pass relocation**: Iteratively refine positions for better coverage
4. **Visualization mode**: Render relocation vectors for debugging

## Success Criteria

1. Cornell box renders without black spots from probes inside geometry
2. Relocation completes in <500ms for typical scenes
3. No regressions in existing test cases
4. Relocation behavior is deterministic and predictable

## Timeline Estimate

- Implementation: 2-3 days
- Testing: 1 day
- Documentation: 0.5 days
- **Total: 3.5-4.5 days**

## Dependencies

- THREE.Raycaster (already available)
- Probe validity system (Phase D1 complete)
- Grid position system (existing)

## Risks

1. **False positives**: Probes incorrectly detected as inside geometry
   - Mitigation: Conservative detection threshold (≥5/6 rays)
   
2. **Poor relocation**: Relocated probes have worse coverage than original
   - Mitigation: Validate relocated position has reasonable visibility
   
3. **Performance regression**: Relocation too slow for large grids
   - Mitigation: Optimize raycasting, add early exit conditions
