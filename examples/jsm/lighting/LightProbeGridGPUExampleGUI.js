export function createLightProbeGridGPUExampleGUI( readLightProbeContext ) {

	const getLightProbeContext = typeof readLightProbeContext === 'function' ? readLightProbeContext : () => readLightProbeContext;
	const _lightProbeContext = new Proxy( {}, {
		get( target, key ) {

			return getLightProbeContext()[ key ];

		}
	} );

	const gui = _lightProbeContext.renderer.inspector.createParameters( 'Probe Grid' );

	gui.add( _lightProbeContext.params, 'resolution', 2, 6, 1 )
		.name( 'resolution' )
		.onChange( async () => {

			await _lightProbeContext.recreateAndBake();

		} );

	gui.add( _lightProbeContext.params, 'cubemapSize', [ 8, 16, 32 ] )
		.name( 'cubemap size' )
		.onChange( async () => {

			await _lightProbeContext.recreateAndBake();

		} );

	gui.add( _lightProbeContext.params, 'materialType', [ 'standard', 'physical', 'lambert', 'phong' ] )
		.name( 'material' )
		.onChange( () => {

			_lightProbeContext.updateMaterialType();

		} );

	gui.add( _lightProbeContext.params, 'probeIntensity', 0, 4, 0.05 )
		.name( 'probe intensity' )
		.onChange( () => {

			if ( _lightProbeContext.probeGrid !== null ) _lightProbeContext.probeGrid.probeIntensity.value = _lightProbeContext.params.probeIntensity;
			_lightProbeContext.applyLightingMode();

		} );

	gui.add( _lightProbeContext.params, 'probeHelperIntensity', 0, 8, 0.05 )
		.name( 'helper exposure' )
		.onChange( ( value ) => {

			if ( _lightProbeContext.probeGrid !== null ) _lightProbeContext.probeGrid.helperIntensity.value = value;

		} );

	gui.add( _lightProbeContext.params, 'probeHelperDebugMode', [ 'irradiance', 'validity' ] )
		.name( 'helper debug' )
		.onChange( ( value ) => {

			if ( _lightProbeContext.probeGrid !== null ) _lightProbeContext.probeGrid.setHelperDebugMode( value );

		} )
		.listen();

	gui.add( _lightProbeContext.params, 'probeHelperDepthMode', [ 'depth-tested', 'x-ray' ] )
		.name( 'helper depth' )
		.onChange( ( value ) => {

			if ( _lightProbeContext.probeGrid !== null ) _lightProbeContext.probeGrid.setHelperDepthMode( value );

		} )
		.listen();

	const advancedFolder = gui.addFolder( 'Advanced' );
	advancedFolder.close();

	advancedFolder.add( _lightProbeContext.params, 'projectionPrecision', [ 'auto', 'half float', 'float' ] )
		.name( 'projection precision' )
		.onChange( async () => {

			await _lightProbeContext.recreateAndBake();

		} );

	advancedFolder.add( _lightProbeContext.params, 'activeProjectionPrecision' ).name( 'active precision' ).listen();

	advancedFolder.add( _lightProbeContext.params, 'band2Intensity', 0, 1, 0.05 )
		.name( 'band 2 intensity' )
		.onChange( ( value ) => {

			if ( _lightProbeContext.probeGrid !== null ) _lightProbeContext.probeGrid.band2Intensity.value = value;

		} );

	advancedFolder.add( _lightProbeContext.params, 'normalBias', 0, 1, 0.05 )
		.name( 'normal bias' )
		.onChange( ( value ) => {

			if ( _lightProbeContext.probeGrid !== null ) _lightProbeContext.probeGrid.normalBias.value = value;

		} );

	advancedFolder.add( _lightProbeContext.params, 'viewBias', 0, 1, 0.05 )
		.name( 'view bias' )
		.onChange( ( value ) => {

			if ( _lightProbeContext.probeGrid !== null ) _lightProbeContext.probeGrid.viewBias.value = value;

		} );

	advancedFolder.add( _lightProbeContext.params, 'leakReductionMode', [ 'off', 'normal' ] )
		.name( 'leak reduction' )
		.onChange( async () => {

			await _lightProbeContext.recreateAndBake();

		} );

	gui.add( _lightProbeContext.params, 'lightingMode', [ 'direct + probes', 'probes only', 'direct only', 'off' ] )
		.name( 'lighting' )
		.onChange( () => {

			_lightProbeContext.updateLightingMode();

		} )
		.listen();

	gui.add( _lightProbeContext.params, 'neutralMaterials' )
		.name( 'neutral material' )
		.onChange( () => {

			_lightProbeContext.updateMaterialMode();

		} );

	gui.add( _lightProbeContext.params, 'probeHelper' )
		.name( 'probe helper' )
		.onChange( ( value ) => {

			if ( _lightProbeContext.baking ) {

				_lightProbeContext.params.probeHelper = value;
				return;

			}

			_lightProbeContext.probeHelper.visible = value;

		} )
		.listen();

	gui.add( _lightProbeContext.params, 'rebake' ).name( 'rebake' );
	gui.add( _lightProbeContext.params, 'bakeStatus' ).name( 'status' ).listen();

	const timingFolder = gui.addFolder( 'Timing' );
	timingFolder.add( _lightProbeContext.timings, 'cubemapMs' ).name( 'cubemap ms' ).listen();
	timingFolder.add( _lightProbeContext.timings, 'projectionMs' ).name( 'project ms' ).listen();
	timingFolder.add( _lightProbeContext.timings, 'copyMs' ).name( 'copy ms' ).listen();
	timingFolder.add( _lightProbeContext.timings, 'totalBakeMs' ).name( 'bake ms' ).listen();
	timingFolder.add( _lightProbeContext.timings, 'frameMs' ).name( 'frame ms' ).listen();

}
