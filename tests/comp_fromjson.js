"use strict";
var tape = require("tape");

var protobuf = require("..");
var strict = require("../src/util/strict");

var proto = "syntax = \"proto3\";\
\
message Inner {\
    int32 v = 1;\
}\
\
message Strict {\
    int32 a = 1;\
    optional int32 a_opt = 2;\
    uint32 b = 3;\
    int64 c = 4;\
    uint64 d = 5;\
    sint32 e = 6;\
    sfixed32 f = 7;\
    fixed32 g = 8;\
    sfixed64 h = 9;\
    fixed64 j = 10;\
    sint64 k = 11;\
    repeated int32 rep = 12;\
    map<int32, int32> mp = 13;\
    Inner sub = 14;\
}\
";

function parsedRoot() {
    return protobuf.parse(proto).root.resolveAll();
}

tape.test("strict.int32 rejects malformed input", function(test) {
    test.throws(function(){ strict.int32("",     "f"); }, /invalid value/, "empty string");
    test.throws(function(){ strict.int32(" 1 ",  "f"); }, /invalid value/, "whitespace");
    test.throws(function(){ strict.int32("+1",   "f"); }, /invalid value/, "leading +");
    test.throws(function(){ strict.int32("01",   "f"); }, /invalid value/, "leading zero");
    test.throws(function(){ strict.int32("0x1F", "f"); }, /invalid value/, "hex");
    test.throws(function(){ strict.int32("1.5",  "f"); }, /invalid value/, "decimal string");
    test.throws(function(){ strict.int32(1.5,    "f"); }, /invalid value/, "decimal number");
    test.throws(function(){ strict.int32(NaN,    "f"); }, /invalid value/, "NaN");
    test.throws(function(){ strict.int32(Infinity, "f"); }, /invalid value/, "Infinity");
    test.throws(function(){ strict.int32(2147483648,  "f"); }, /invalid value/, "above int32 max");
    test.throws(function(){ strict.int32(-2147483649, "f"); }, /invalid value/, "below int32 min");
    test.throws(function(){ strict.int32(null,   "f"); }, /invalid value/, "null");
    test.throws(function(){ strict.int32(true,   "f"); }, /invalid value/, "boolean");
    test.equal(strict.int32(0, "f"), 0, "zero number");
    test.equal(strict.int32("0", "f"), 0, "zero string");
    test.equal(strict.int32(2147483647, "f"), 2147483647, "int32 max");
    test.equal(strict.int32("-2147483648", "f"), -2147483648, "int32 min as string");
    // ProtoJSON allows JSON-number forms when they resolve to an integer in range.
    test.equal(strict.int32("1e3",   "f"), 1000,   "exponential resolves to integer");
    test.equal(strict.int32("1.5e3", "f"), 1500,   "fractional exponential resolves to integer");
    test.equal(strict.int32("100.0", "f"), 100,    "trailing zeros after decimal");
    test.throws(function(){ strict.int32("1e10", "f"); }, /invalid value/, "exponential overflow");
    test.end();
});

tape.test("strict.uint32 rejects negative and overflow", function(test) {
    test.throws(function(){ strict.uint32(-1, "f"); }, /invalid value/, "negative number");
    test.throws(function(){ strict.uint32("-1", "f"); }, /invalid value/, "negative string");
    test.throws(function(){ strict.uint32(4294967296, "f"); }, /invalid value/, "above uint32 max");
    test.throws(function(){ strict.uint32("01", "f"); }, /invalid value/, "leading zero");
    test.equal(strict.uint32(4294967295, "f"), 4294967295, "uint32 max");
    test.equal(strict.uint32("0", "f"), 0, "zero");
    test.end();
});

tape.test("strict.int64 round-trips Long boundary values", function(test) {
    var max = strict.int64("9223372036854775807", "f", true, true);
    test.equal(max.toString(), "9223372036854775807", "int64 max");
    var min = strict.int64("-9223372036854775808", "f", true, true);
    test.equal(min.toString(), "-9223372036854775808", "int64 min");
    var umax = strict.int64("18446744073709551615", "f", false, true);
    test.equal(umax.toString(), "18446744073709551615", "uint64 max");
    test.throws(function(){ strict.int64("9223372036854775808",  "f", true,  true); }, /invalid value/, "int64 overflow");
    test.throws(function(){ strict.int64("-9223372036854775809", "f", true,  true); }, /invalid value/, "int64 underflow");
    test.throws(function(){ strict.int64("18446744073709551616", "f", false, true); }, /invalid value/, "uint64 overflow");
    test.throws(function(){ strict.int64("-1",  "f", false, true); }, /invalid value/, "uint64 negative");
    test.throws(function(){ strict.int64(" 1 ", "f", true,  true); }, /invalid value/, "whitespace");
    test.throws(function(){ strict.int64("",    "f", true,  true); }, /invalid value/, "empty");
    // Exponential within safe-integer range is accepted (ProtoJSON spec).
    test.equal(strict.int64("1e3", "f", true, true).toString(), "1000", "exponential int64");
    // Beyond safe range, exponential form is ambiguous → rejected.
    test.throws(function(){ strict.int64("1e20", "f", true, true); }, /invalid value/, "exponential out of safe range");
    // Unquoted JS number near int64 boundary: precision is already lost, but Long.fromNumber clamps.
    var nearMax = strict.int64(9223372036854775000, "f", true, true);
    test.equal(typeof nearMax.toString(), "string", "lossy unquoted number returns Long");
    test.end();
});

tape.test("Type.fromJSON rejects malformed scalars", function(test) {
    var Strict = parsedRoot().lookupType("Strict");
    test.throws(function(){ Strict.fromJSON({ a: "" });          }, /invalid value/, "int32 empty string");
    test.throws(function(){ Strict.fromJSON({ a: "01" });        }, /invalid value/, "int32 leading zero");
    test.throws(function(){ Strict.fromJSON({ a: 2147483648 });  }, /invalid value/, "int32 overflow");
    test.throws(function(){ Strict.fromJSON({ a: 1.5 });         }, /invalid value/, "int32 decimal");
    test.throws(function(){ Strict.fromJSON({ b: -1 });          }, /invalid value/, "uint32 negative");
    test.throws(function(){ Strict.fromJSON({ c: " 1 " });       }, /invalid value/, "int64 whitespace");
    test.throws(function(){ Strict.fromJSON({ c: "9223372036854775808" }); }, /invalid value/, "int64 overflow");
    test.throws(function(){ Strict.fromJSON({ d: "-1" });        }, /invalid value/, "uint64 negative");
    test.throws(function(){ Strict.fromJSON({ d: "18446744073709551616" }); }, /invalid value/, "uint64 overflow");
    test.throws(function(){ Strict.fromJSON({ e: "abc" });       }, /invalid value/, "sint32 non-numeric");
    test.throws(function(){ Strict.fromJSON({ rep: [1, "x"] });  }, /invalid value/, "repeated invalid element");
    test.throws(function(){ Strict.fromJSON({ mp: { 1: "x" } }); }, /invalid value/, "map invalid value");
    test.end();
});

tape.test("Type.fromJSON accepts JSON string input", function(test) {
    var Strict = parsedRoot().lookupType("Strict");
    var m = Strict.fromJSON("{\"a\":42,\"c\":\"-7\"}");
    test.equal(m.a, 42, "parsed int32 from JSON string");
    test.equal(m.c.toString(), "-7", "parsed int64 from JSON string");
    test.end();
});

tape.test("Type.fromJSON preserves implicit-presence default-skip", function(test) {
    var Strict = parsedRoot().lookupType("Strict");
    var m = Strict.fromJSON({ a: 0, c: "0" });
    test.equal(Object.prototype.hasOwnProperty.call(m, "a"), false, "int32 zero stays inherited");
    test.equal(Object.prototype.hasOwnProperty.call(m, "c"), false, "int64 zero stays inherited");
    test.equal(Strict.encode(m).finish().length, 0, "encodes to zero-length wire format");
    test.equal(JSON.stringify(Strict.toObject(m, { json: true })), "{}", "toObject({json:true}) omits defaults");
    test.end();
});

tape.test("Type.fromJSON keeps explicit-presence zero own", function(test) {
    var Strict = parsedRoot().lookupType("Strict");
    var m = Strict.fromJSON({ aOpt: 0 });
    test.equal(Object.prototype.hasOwnProperty.call(m, "aOpt"), true, "explicit zero stays as own property");
    test.equal(m.aOpt, 0, "value is 0");
    test.end();
});

tape.test("Type.fromJSON propagates strictness into nested messages", function(test) {
    var Strict = parsedRoot().lookupType("Strict");
    test.throws(function(){ Strict.fromJSON({ sub: { v: "abc" } }); }, /invalid value/, "nested invalid");
    var m = Strict.fromJSON({ sub: { v: 5 } });
    test.equal(m.sub.v, 5, "nested valid");
    test.end();
});

tape.test("Type.fromObject stays lenient (backwards compat)", function(test) {
    var Strict = parsedRoot().lookupType("Strict");
    var m = Strict.fromObject({ a: "0" });
    test.equal(m.a, 0, "fromObject still coerces \"0\" leniently");
    test.equal(Strict.encode(m).finish().length, 0, "lenient default still encodes empty");
    test.end();
});

tape.test("Type.fromJSON parses repeated int32 with strict elements", function(test) {
    var Strict = parsedRoot().lookupType("Strict");
    var m = Strict.fromJSON({ rep: [1, "2", "1e3"] });
    test.deepEqual(m.rep, [1, 2, 1000], "elements are strict-parsed and assigned");
    test.throws(function(){ Strict.fromJSON({ rep: ["01"] }); }, /invalid value/, "leading-zero element rejected");
    test.end();
});

tape.test("Type.fromJSON parses map<int32,int32> with strict keys/values", function(test) {
    var Strict = parsedRoot().lookupType("Strict");
    var m = Strict.fromJSON({ mp: { 1: 2, 3: "4" } });
    test.equal(m.mp[1], 2, "value preserved");
    test.equal(m.mp[3], 4, "string value strict-parsed");
    test.throws(function(){ Strict.fromJSON({ mp: { 1: "1.5" } }); }, /invalid value/, "decimal value rejected");
    test.end();
});

tape.test("Wrapper types keep fromJSON aliased to lenient fromObject", function(test) {
    // Wrappers (Any/Timestamp/Duration/...) install custom fromObject logic
    // that the strict ProtoJSON path defers to. Construct a fresh Any whose
    // fully-qualified name matches the wrapper registry, then trigger lazy
    // setup() so the wrapper hook installs and aliases fromJSON to fromObject.
    var anyType = new protobuf.Type("Any");
    anyType.add(new protobuf.Field("type_url", 1, "string"));
    anyType.add(new protobuf.Field("value", 2, "bytes"));
    new protobuf.Root().define("google.protobuf").add(anyType);
    anyType.setup();
    test.equal(typeof anyType.fromJSON, "function", "wrapped type still exposes fromJSON");
    test.equal(anyType.fromJSON, anyType.fromObject, "fromJSON === fromObject for wrappers");
    test.end();
});
