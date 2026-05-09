var tape = require("tape");

var protobuf = require("..");

// These cases mirror four conformance failures (one per syntax: proto2,
// proto3, editions_proto2, editions_proto3 — 16 total) in the official
// Protocol Buffers conformance suite:
//
//   *.JsonInput.BoolFieldDoubleQuotedFalse
//   *.JsonInput.BoolFieldDoubleQuotedTrue
//   *.JsonInput.BoolFieldIntegerOne
//   *.JsonInput.BoolFieldIntegerZero
//
// ProtoJSON only accepts the JSON booleans `true` and `false` for
// proto bool fields. Quoted strings and numeric `0`/`1` must be rejected.

function makeBoolType() {
    var root = protobuf.Root.fromJSON({
        nested: {
            BoolMessage: {
                fields: {
                    flag: {
                        type: "bool",
                        id: 1
                    }
                }
            }
        }
    });
    return root.lookupType("BoolMessage");
}

tape.test("ProtoJSON bool strict parsing - accepts true/false", function(test) {
    var BoolMessage = makeBoolType();

    var msgTrue = BoolMessage.fromObject({ flag: true });
    test.equal(msgTrue.flag, true, "JSON true should be accepted as bool true");

    var msgFalse = BoolMessage.fromObject({ flag: false });
    test.equal(msgFalse.flag, false, "JSON false should be accepted as bool false");

    // Field absence / null is fine — leaves default.
    var msgMissing = BoolMessage.fromObject({});
    test.equal(msgMissing.flag, false, "missing field stays default");

    var msgNull = BoolMessage.fromObject({ flag: null });
    test.equal(msgNull.flag, false, "null is treated as absence (default)");

    test.end();
});

tape.test("ProtoJSON bool strict parsing - rejects quoted \"true\" (BoolFieldDoubleQuotedTrue)", function(test) {
    var BoolMessage = makeBoolType();
    test.throws(function() {
        BoolMessage.fromObject({ flag: "true" });
    }, TypeError, "quoted \"true\" string must throw TypeError");
    test.end();
});

tape.test("ProtoJSON bool strict parsing - rejects quoted \"false\" (BoolFieldDoubleQuotedFalse)", function(test) {
    var BoolMessage = makeBoolType();
    test.throws(function() {
        BoolMessage.fromObject({ flag: "false" });
    }, TypeError, "quoted \"false\" string must throw TypeError");
    test.end();
});

tape.test("ProtoJSON bool strict parsing - rejects integer 1 (BoolFieldIntegerOne)", function(test) {
    var BoolMessage = makeBoolType();
    test.throws(function() {
        BoolMessage.fromObject({ flag: 1 });
    }, TypeError, "integer 1 must throw TypeError");
    test.end();
});

tape.test("ProtoJSON bool strict parsing - rejects integer 0 (BoolFieldIntegerZero)", function(test) {
    var BoolMessage = makeBoolType();
    test.throws(function() {
        BoolMessage.fromObject({ flag: 0 });
    }, TypeError, "integer 0 must throw TypeError");
    test.end();
});

tape.test("ProtoJSON bool strict parsing - rejects other non-bool inputs", function(test) {
    var BoolMessage = makeBoolType();

    test.throws(function() {
        BoolMessage.fromObject({ flag: "yes" });
    }, TypeError, "arbitrary string must throw TypeError");

    test.throws(function() {
        BoolMessage.fromObject({ flag: 42 });
    }, TypeError, "arbitrary number must throw TypeError");

    test.throws(function() {
        BoolMessage.fromObject({ flag: {} });
    }, TypeError, "object must throw TypeError");

    test.throws(function() {
        BoolMessage.fromObject({ flag: [] });
    }, TypeError, "array must throw TypeError");

    test.end();
});
