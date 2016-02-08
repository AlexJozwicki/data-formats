# Data Formats


## Sample usage

```javascript
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

        json`numberBoolean`,

        json`b`.number().min( 5 ).max( 10 ),
        json`c`.number().abs(),

        json`sum`.rawTransform( json => (+json[ 'b' ]) + (+json[ 'c' ]) ),      // we can create new fields based on multiple ones, read only

        node`singleFoo`.is( Foo.format ),
        node`nullFoo`.is( Foo.format ),

        json`arrayOfFoos`.arrayOf( Foo.format ),

        json`idInCollection`.idResolver( objectToResolve ),
);

```
