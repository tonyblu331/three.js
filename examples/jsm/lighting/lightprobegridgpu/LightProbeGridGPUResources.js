import {
	Mesh,
	OrthographicCamera,
	PlaneGeometry,
	Scene
} from 'three/webgpu';

export const disposeLightProbeGridGPUResource = ( resource ) => {

	if ( resource !== null ) resource.dispose();

};

export const disposeLightProbeGridGPUFullscreenMesh = ( mesh ) => {

	if ( mesh !== null ) mesh.geometry.dispose();

};

export const disposeLightProbeGridGPUHelper = ( helper ) => {

	if ( helper === null ) return;

	helper.geometry.dispose();
	helper.material.dispose();

};

export const createLightProbeGridGPUFullscreenPass = ( material ) => {

	const camera = new OrthographicCamera( - 1, 1, 1, - 1, - 1, 1 );
	const mesh = new Mesh( new PlaneGeometry( 2, 2 ), material );
	const scene = new Scene();

	scene.add( mesh );

	return { camera, mesh, scene };

};
