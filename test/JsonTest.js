import { Format, json, number, boolean, node } from '../src/Json';

/**
 * First, a small model, to test composites
 */
class Foo {
    bar: string;

    static format = new Format( Foo, json`bar` );
}


/**
 * This is the actual target model
 */
class Test {
    isoMapping          : string;
    nameMapping         : string;

set readonly( value )   { this._readonly = 'this will never be set from the JSON to here'; }
get writeonly()         { return 'this will never be set to the JSON from here'; }

    preserveNull        : ?Object;
    defaultValueTest    : string;
    b                   : number;
    c                   : number;
    sum                 : number;

    singleFoo           : Foo;
    nullFoo             : ?Foo;
    arrayOfFoos         : Array< Foo >;

    foo: A;
}

const objectToResolve = [ { id: '1', title: 'First object' }, { id: '2', title: 'Second object' } ];


/**
 *
 * This is where the real stuff begins :)
 *
 */
const testFormat = new Format( Test,
        json`isoMapping`,
        json`nameMapping`.to( 'anotherName' ),
        json`readonly`.readonly(),              // only from JSON -> model
        json`writeonly`.writeonly(),            // only from model -> JSON

        json`preserveNull`,
        json`butDropUndefined`,

        json`defaultValueTest`.defaultsTo( 'this is the default value when none is existing in the JSON or model' ),

        json`stringBoolean`.boolean().readonly(),
        json`stringBoolean`.transform( () => 0, b => b ? 'true' : 'false' ).writeonly(),

     boolean`numberBoolean`,

      number`b`.min( 5 ).max( 10 ),
      number`c`.abs(),

        json`sum`.rawTransform( json => (+json[ 'b' ]) + (+json[ 'c' ]) ),      // we can create new fields based on multiple ones, read only

        node`singleFoo`.is( Foo.format ),
        node`nullFoo`.is( Foo.format ),

        json`arrayOfFoos`.arrayOf( Foo.format ),

        json`idInCollection`.idResolver( objectToResolve ),
);


/**
 * Mock a JSON object
 */
const jsonData = {
    isoMapping  : 'Field name is the same in both JSON and object',
    nameMapping : 'Field name is mapped to something else',
    readonly    : 'Some fields can be read only, and will never appear back to the JSON',

    stringBoolean : 'true',
    numberBoolean : '0',

    preserveNull: null,

    b: '14',
    c: '-16',

    singleFoo: {
        bar: 'this is bar'
    },

    arrayOfFoos: [{ bar: 'first bar' },{ bar: 'second bar' }],

    idInCollection: '2'
};


/**
 * Woohoo
 */
const model = testFormat.read( jsonData );

console.log( model );
console.log( testFormat.write( model ) );





const crappyApiTestFormat = new Format( Test,
    json`NOM`.to( 'anotherName' ),
    json`CHAINE_BOOLEAN`.to( 'stringBoolean' ).boolean(),

    json`BE`.to( 'b' ).number().min( 5 ).max( 10 ),
    json`CEE`.to( 'c' ).number(),
    node`Fou`.to( 'singleFoo' ).is( Foo.format ),
    json`PleinDeFous`.to( 'arrayOfFoos' ).arrayOf( Foo.format ),
);

console.log( crappyApiTestFormat.write( model ) );





class Test2 extends Test {
    extendedField: string;

    static format = testFormat.extend( Test2, json`extendedField` );

    foo() {
        console.log( 'this is really a Test2' );
    }
}


const jsonTest2 = {
    ...jsonData,
    extendedField: 'This is an extended field'
};

const model2 = Test2.format.read( jsonTest2 );
console.log( model2 );
model2.foo();
