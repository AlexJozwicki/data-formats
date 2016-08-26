/* @flow */
import _ from 'lodash';
import moment from 'moment';
import type Moment from 'moment';
import invariant from 'invariant';

/**
 * This is a base class for any formatter.
 */
export class AbstractFormat< S, D > {
    read( from: ?S ) : ?D {}
    write( model: ?D ) : ?S {}
}


/**
 * Json formatter
 *
 * This formats an object/class, based on a list of mappers
 * It is always linked to a specific class, that it will create when reading a source object.
 *
 */
export class Format< T > extends AbstractFormat< Object, T > {
    _cl             : Class< T >;
    _mappers        : Array< Mapper< Object, any > > = [];
    dropUndefined   : boolean = true;
    _read           : ( source: Object, out: T ) => void;

    /** read-only access to the mappers, we don't want them to be changed */
    get mappers() : Array< Mapper< Object, any > > { return this._mappers; }

    /**
     * Ctor.
     */
    constructor( cl: Class< T >, ...mappers: Array< Mapper< Object, any > > ) {
        super();
        this._cl = cl;
        this._mappers = mappers;

        this._read = mappers.map( f => ( source, out ) => {
            const value = f.read( source );
            if( this.dropUndefined && value === undefined ) return;

            // $FlowComputedProperty
            out[ f.modelName ] = value;
        } ).reduce( ( a, b ) => ( source, out ) => { a( source, out ); b( source, out ); } );
    }


    /**
     * Reads a source object into the target class, using the mappers.
     * @param  {?Object}    source  source object
     * @return {?T}                 target class, if we were able to read something
     */
    read( source: ?Object ) : ?T {
        if( !source ) return null;

        try {
            // $IgnoreFlow
            var out : T = new this._cl();
            this._read( source, out );
            return out;
        }
        // a formatter should not throw exception ideally. we just firewall the thing here to stop messing up everything
        catch( e ) {
            console.log( 'A format read completely exploded.', e );
        }
    }

    validate( source: ?Object ) : { then: ( o: T ) => void, catch: ( errors: Array< string > ) => void } {
        return {
            then: ( o ) => {},
            catch: ( errors ) => {}
        }
    }

    /**
     * Transforms the writer into a write only formatter.
     * @param  {boolean}        silent      whether to throw an exception or not when you try to write anything with this formatter
     * @return {Format< T >}                the new write only formatter
     */
    writeonly( silent: boolean = true ) : Format< T > {
        const baseFormat = this;

        return new class extends Format< T > {
            read() {
                console.error( 'This is a write only writer.' );
                if( !silent ) throw 'This is a write only writer';
            }
        }( this._cl, ...this._mappers );
    }

    /**
     * Transforms the writer into a read only formatter.
     * @param  {boolean}        silent      whether to throw an exception or not when you try to read anything with this formatter
     * @return {Format< T >}                the new read only formatter
     */
    readonly( silent: boolean = true ) : Format< T > {
        const baseFormat = this;

        return new class extends Format< T > {
            write() {
                console.error( 'This is a read only writer.' );
                if( !silent ) throw 'This is a read only writer';
            }
        }( this._cl, ...this._mappers );
    }

    /**
     * Writes a class into a plain object, usually JSON
     * @param  {?T}         model
     * @return {?Object}    plain old object, if we were able to write anything
     */
    write( model: ?T ) : ?Object {
        if( !model ) return null;

        try {
            var out = Object.create( null );

            this._mappers.filter( f => !!f.write ).forEach( f => {
                const value = f.write( model );
                if( this.dropUndefined && value === undefined ) return;

                out[ f.name ] = f.write( model );
            } );

            return out;
        }
        // a formatter should not throw exception ideally. we just firewall the thing here to stop messing up everything
        catch( e ) {
            console.log( 'A format write completely exploded.', e );
        }
    }

    transform< NT >( read: ( value: ?T ) => ?NT, write: ( value: ?NT ) => ?any ) : AbstractFormat< Object, NT > {
        return new class extends AbstractFormat< Object, NT > {

        }
    }

    /**
     * A formatter can be extended.
     * Extended means that we add mappers to the original list, which in term translate into having a new target class.
     * @param  {Class< ET >}           cl           the new target class
     * @param  {Array< Mapper >]}   ...mappers      the list of mapppers to add
     * @return {Format< ET >}                       the formatter for the new class ET
     */
    extend< ET: T >( cl: Class< ET >, ...mappers: Array< Mapper< any, any > > ) : Format< ET > {
        invariant( !!cl, 'Format.extend should be called with a valid class' );
        return new Format( cl, ...[ ...mappers, ...this._mappers ] );
    }
}


/**
 * A mapper keeps track of the source and destination names of the object, as well as read and write functions
 */
class SimpleMapper< F, T > {
    read : ( other: any ) => ?any;
    write: ( model: any ) => ?any;

    name        : string;
    modelName   : string;

    constructor( name: string, modelName: string, read: ( other: F ) => ?T, write: ( model: T ) => ?F ) {
        this.name = name;
        this.modelName = modelName;
        this.read = read;
        this.write = write;
    }
}


/**
 * A mapper maps a property from a source object, to a value.
 *
 */
export class Mapper< F, T > extends SimpleMapper< F, T > {
    constructor( name: string, modelName: string, read: ( other: F ) => ?T, write: ( model: T ) => ?F ) {
        super( name, modelName, read, write );
    }


    /**
     * Converts to a boolean
     */
    boolean() : Mapper< F, boolean > {
        return this.transform( b => ( b !== undefined && ( b === true || b === 'true' || b === '1' || b === 1 ) ), b => b );
    }

    /**
     * Converts to a number
     */
    number() : NumberMapper< F > {
        return new NumberMapper( this.name, this.modelName, v => +this.read( v ), this.write );
    }

    /**
     * Reads an array, using a format
     * @param  {AbstractFormat}     f   the formatter that will be used for each element of the collection
     */
    arrayOf( f: AbstractFormat< F, T > ) : Mapper< F, T > {
        return this.transform(
            a => ( Array.isArray( a ) ? a.map( e => f.read( e ) ) : void 0 ),
            a => ( Array.isArray( a ) ? a.map( e => f.write( e ) ) : void 0 )
        );
    }

    /**
     * Parses a date
     * @param  {string}     format  the format of the date
     */
    date( format: string = 'YYYY-MM-DD[T]HH:mm:ss.SSSZ' ) : Mapper< F, Moment >{
        return this.transform( v => moment( v, format ), v => v );
    }

    /**
     * Converts the mapper to a readonly one, ie: only goes from JSON to Model
     */
    readonly() : Mapper< F, T > {
        return new Mapper( this.name, this.modelName, this.read, _ => void 0 );
    }

    /**
     * Converts the mapper to a writeonly one, ie. only goes from Model to JSON
     */
    writeonly() : Mapper< F, T >  {
        return new Mapper( this.name, this.modelName, _ => void 0, this.write );
    }

    /**
     * Assigns a default value
     * @param  {T}                  value   the default value
     * @return {Mapper< F, T >}
     */
    defaultsTo( value: T ) : Mapper< F, T > {
        return this.transform( v => v || value, v => v || value );
    }

    /**
     * Consideres that the field is an id, of an object which we have in memory and need to find.
     * @param  {Array< Object >}    array       the array in which to search
     * @param  {string}             idField     name of the id field in the object of array
     */
    idResolver( array: Array< Object >, idField: string = 'id' ) : Mapper< F, T > {
        return this.transform( v => _.find( array, { [ idField ]: v } ), v => !!v ? v[ idField ] : null );
    }

    // $IgnoreFlow
    transform< NT >( read: ( value: ?any ) => ?any, write: ( model: ?any ) => ?any ) : Mapper< F, NT > {
        return new Mapper( this.name, this.modelName, o => read( this.read( o ) ), m => write( this.write( m ) ) );
    }
}


/**
 * Once the original mapper has been converted to an number, we use this class to further refine it
 */
export class NumberMapper< F > extends Mapper< F, number > {
    abs( m: number ) : Mapper< F, number > {
        return this.transform( v => v ? Math.abs( v ) : v, v => v );
    }

    min( m: number ) : Mapper< F, number > {
        return this.transform( v => v ? Math.max( v, m ) : m, v => v );
    }

    max( m: number ) : Mapper< F, number > {
        return this.transform( v => v ? Math.min( v, m ) : m, v => v );
    }

    // $IgnoreFlow
    transform( read: ( value: ?any ) => ?any, write: ( model: ?any ) => ?any ) : NumberMapper< F > {
        return new NumberMapper( this.name, this.modelName, other => read( this.read( other ) ), this.write );
    }
}


/**
 * a JSON Value; mapping of name can only be done at the very beginning.
 * After that, each transform, transforms the value
 */
export class JsonValue< T > extends Mapper< Object, T > {
    /**
     * First and last chance to modify the name in the target model
     * @param  {string} modelName   the new name for the value inside the model
     */
    to( modelName: string ) : Mapper< Object, T > {
        // $FlowComputedProperty
        return new JsonValue( this.name, modelName, this.read, model => model[ modelName ] );
    }

    /**
     * A raw transformation is the very first step of a mapper, and takes place on the whole JSON object.
     * You can do low-level stuff in here
     *
     * @param  {( json: Object ) => ?T}     read
     * @param  {( json: T ) => ?Object}     write
     * @return {Mapper< Object, T >}
     */
    rawTransform( read: ( json: Object ) => ?T, write: ( model: T ) => ?Object ) : Mapper< Object, T > {
        return new Mapper( this.name, this.modelName, read, write );
    }
}


/**
 * A JSON value, inside a JSON node basically.
 */
export function json< T >( strings: Array< string > ) : JsonValue< T > {
    const name : string = strings[ 0 ];
    // $FlowComputedProperty
    return new JsonValue( name, name, j => j[ name ], m => m[ name ] );
}



export class JsonNode< T > extends JsonValue< T > {
   /*
    * First and last chance to modify the name in the target model
    * @param  {string} modelName   the new name for the value inside the model
    */
    to( modelName: string ) : Mapper< Object, T > {
        // $FlowComputedProperty
        return new JsonNode( this.name, modelName, this.read, model => model[ modelName ] );
    }

    is< T >( f: AbstractFormat< Object, T > ) : Mapper< Object, T > {
        invariant( !!f && !!f.read && !!f.write, 'JsonNode.is should be called with a valid format' );

        return this.transform( v => f.read( v ), v => f.write( v ) );
    }
}

export function node< T >( strings: Array< string > ) : JsonNode< T > {
    const name : string = strings[ 0 ];
    // $FlowComputedProperty
    return new JsonNode( name, name, json => json[ name ], model => model[ name ] );
}



export function number< T >( strings: Array< string > ) : NumberMapper< Object >{
    return json( strings ).number();
}

export function boolean< T >( strings: Array< string > ) : Mapper< Object, boolean >{
    return json( strings ).boolean();
}
