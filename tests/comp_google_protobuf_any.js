var tape = require("tape");

var protobuf = require("..");

var root = new protobuf.Root().addJSON(protobuf.common["google/protobuf/any.proto"].nested).addJSON({
    Foo: {
        fields: {
            foo: {
                id: 1,
                type: "google.protobuf.Any"
            }
        }
    },
    Bar: {
        fields: {
            bar: {
                id: 1,
                type: "string"
            }
        }
    },
    Loop: {
        fields: {
            next: {
                id: 1,
                type: "google.protobuf.Any"
            }
        }
    }
}).resolveAll();

var Any = root.lookupType("protobuf.Any"),
    Foo = root.lookupType(".Foo"),
    Bar = root.lookupType(".Bar"),
    Loop = root.lookupType(".Loop");

tape.test("google.protobuf.Any", function(test) {

    var foo = Foo.fromObject({
        foo: {
            type_url: "Bar",
            value: [1 << 3 | 2, 1, 97] // value = "a"
        }
    });
    test.ok(foo.foo instanceof Any.ctor, "should keep explicit Any in fromObject");
    test.same(foo.foo, { type_url: "Bar", value: [10, 1, 97] }, "should keep explicit Any in fromObject properly");

    var obj = Foo.toObject(foo);
    test.same(obj.foo, { type_url: "Bar", value: [10, 1, 97] }, "should keep explicit Any in toObject properly");

    test.throws(function() {
        Foo.toObject(foo, { json: true });
    }, /invalid Any type URL: Bar/, "should reject explicit Any JSON expansion without slash");

    foo = Foo.fromObject({
        foo: {
            type_url: "type.googleapis.com/Bar",
            value: [1 << 3 | 2, 1, 97] // value = "a"
        }
    });
    obj = Foo.toObject(foo, { json: true });
    test.same(obj.foo, { "@type": "type.googleapis.com/Bar", bar: "a" }, "should decode explicitly Any in toObject if requested");

    test.throws(function() {
        Foo.fromObject({
            foo: {
                "@type": ".Bar",
                bar: "a"
            }
        });
    }, /invalid Any type URL: \.Bar/, "should reject Any @type with a leading dot");

    foo = Foo.fromObject({
        foo: {
            "@type": "type.googleapis.com/Bar",
            bar: "a"
        }
    });
    test.ok(foo.foo instanceof Any.ctor, "should convert to Any in fromObject");
    test.same(foo.foo, { type_url: "type.googleapis.com/Bar", value: protobuf.util.newBuffer([10, 1, 97]) }, "should have correct Any object when converted with fromObject");

    test.throws(function() {
        Foo.fromObject({
            foo: {
                "@type": "Bar",
                bar: "a"
            }
        });
    }, /invalid Any type URL: Bar/, "should reject Any @type without slash");

    test.throws(function() {
        Foo.fromObject({
            foo: {
                "@type": "type.googleapis.com/Missing",
                bar: "a"
            }
        });
    }, /no such type: Missing/, "should reject unknown Any @type");

    var baz = Foo.fromObject({
        foo: {
            type_url: "type.someurl.com/Bar",
            value: [1 << 3 | 2, 1, 97] // value = "a"
        }
    });
    obj = Foo.toObject(baz, { json: true });
    test.same(obj.foo, { "@type": "type.someurl.com/Bar", bar: "a" }, "should keep prefix in type url");

    test.throws(function() {
        Foo.toObject(Foo.fromObject({
            foo: {
                type_url: "type.someurl.com/Missing",
                value: [1 << 3 | 2, 1, 97]
            }
        }), { json: true });
    }, /no such type: Missing/, "should reject unknown Any type_url when expanding to JSON");

    test.throws(function() {
        Foo.toObject(Foo.fromObject({
            foo: {
                type_url: "type.googleapis.com/.Bar",
                value: [1 << 3 | 2, 1, 97]
            }
        }), { json: true });
    }, /invalid Any type URL: type\.googleapis\.com\/\.Bar/, "should reject Any type_url with a leading dot when expanding to JSON");

    test.end();
});

tape.test("google.protobuf.Any - toObject recursion limit", function(test) {

    var recursionLimit = protobuf.util.recursionLimit;
    protobuf.util.recursionLimit = 3;
    try {
        var value = Loop.encode(Loop.create()).finish();
        for (var i = 0; i < 5; ++i)
            value = Loop.encode(Loop.create({
                next: Any.create({
                    type_url: "type.googleapis.com/Loop",
                    value: value
                })
            })).finish();

        var message = Loop.decode(value);

        test.throws(function() {
            JSON.stringify(message);
        }, /max depth exceeded/, "should reject excessive Any JSON expansion depth");
    } finally {
        protobuf.util.recursionLimit = recursionLimit;
    }

    test.end();
});
