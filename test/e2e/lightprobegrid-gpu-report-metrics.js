export const roundMetric = value => Number( value.toFixed( 4 ) );

export const histogramBy = ( rows, key ) => rows.reduce( ( result, row ) => {

	const value = String( row[ key ] ?? 'none' );
	result[ value ] = ( result[ value ] ?? 0 ) + 1;
	return result;

}, {} );

export const sumMetricBy = ( rows, key ) => roundMetric( rows.reduce(
	( total, row ) => total + ( row[ key ] ?? 0 ),
	0
) );

export const sumRequiredMetricBy = ( rows, key ) => roundMetric( rows.reduce(
	( total, row ) => total + row[ key ],
	0
) );

export const sumMetricValues = values => roundMetric( values.reduce(
	( total, value ) => total + ( value ?? 0 ),
	0
) );

export const minMetricBy = ( rows, key ) => rows.length > 0 ?
	roundMetric( Math.min( ...rows.map( row => row[ key ] ?? 0 ) ) ) :
	0;

export const maxMetricBy = ( rows, key ) => rows.length > 0 ?
	roundMetric( Math.max( ...rows.map( row => row[ key ] ?? 0 ) ) ) :
	0;

export const meanMetricBy = ( rows, key ) => rows.length > 0 ?
	roundMetric( sumMetricBy( rows, key ) / rows.length ) :
	0;
