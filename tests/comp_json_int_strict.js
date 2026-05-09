"use strict";
var tape = require("tape");

var protobuf = require("..");

// Mirrors the integer strict-parsing slice of the protobuf JSON conformance
// suite (see conformance/binary_json_conformance_suite.cc). The proto JSON
// spec requires parsers to reject:
//   - non-numeric strings (Int32FieldNotNumber, etc.)
//   - non-integer numeric values (Int32FieldNotInteger)
//   - empty strings (Int32FieldEmptyString)
//   - out-of-range values (Int32FieldTooLarge / TooSmall, Uint32FieldTooLarge,
//     Int64FieldTooLarge / TooSmall, Uint64FieldTooLarge)
//   - leading/trailing whitespace in numeric strings
// 64-bit ints additionally allow numeric input (MaxValueNotQuoted) and string
// input but must round-trip the full uint64 max.

function makeRoot() {
    return protobuf.Root.fromJSON({
        nested: {
            IntMessage: {
                fields: {
                    int32Val:    { type: "int32",    id: 1 },
                    sint32Val:   { type: "sint32",   id: 2 },
                    sfixed32Val: { type: "sfixed32", id: 3 },
                    uint32Val:   { type: "uint32",   id: 4 },
                    fixed32Val:  { type: "fixed32",  id: 5 },
                    int64Val:    { type: "int64",    id: 6 },
                    sint64Val:   { type: "sint64",   id: 7 },
                    sfixed64Val: { type: "sfixed64", id: 8 },
                    uint64Val:   { type: "uint64",   id: 9 },
                    fixed64Val:  { type: "fixed64",  id: 10 }
                }
            }
        }
    });
}

function expectThrow(test, IntMessage, key, value, label) {
    var obj = {};
    obj[key] = value;
    test.throws(function() { IntMessage.fromObject(obj); }, label);
}

tape.test("JSON integer strict parsing - uint32", function(test) {
    var Msg = makeRoot().lookupType("IntMessage");

    expectThrow(test, Msg, "uint32Val", "abc",        "Uint32FieldNotNumber (string \"abc\")");
    expectThrow(test, Msg, "uint32Val", "3x3",        "Uint32FieldNotNumber (string \"3x3\")");
    expectThrow(test, Msg, "uint32Val", 0.5,          "Uint32FieldNotInteger (0.5)");
    expectThrow(test, Msg, "uint32Val", 4294967296,   "Uint32FieldTooLarge (4294967296)");
    expectThrow(test, Msg, "uint32Val", -1,           "Uint32 negative");
    expectThrow(test, Msg, "uint32Val", "",           "Uint32FieldEmptyString");
    expectThrow(test, Msg, "uint32Val", " 1",         "Uint32 leading space");
    expectThrow(test, Msg, "uint32Val", "1 ",         "Uint32 trailing space");
    expectThrow(test, Msg, "uint32Val", true,         "Uint32 boolean");
    expectThrow(test, Msg, "uint32Val", NaN,          "Uint32 NaN");
    expectThrow(test, Msg, "uint32Val", Infinity,     "Uint32 Infinity");

    // Valid inputs should still work.
    test.equal(Msg.fromObject({ uint32Val: 0 }).uint32Val,          0,          "uint32 zero");
    test.equal(Msg.fromObject({ uint32Val: 4294967295 }).uint32Val, 4294967295, "uint32 max");
    test.equal(Msg.fromObject({ uint32Val: "42" }).uint32Val,       42,         "uint32 string");
    test.equal(Msg.fromObject({ uint32Val: 100000.0 }).uint32Val,   100000,     "uint32 float trailing zero");
    test.equal(Msg.fromObject({ uint32Val: 1e5 }).uint32Val,        100000,     "uint32 exponential");
    test.equal(Msg.fromObject({ uint32Val: "1e5" }).uint32Val,      100000,     "uint32 quoted exponential");

    test.end();
});

tape.test("JSON integer strict parsing - int32", function(test) {
    var Msg = makeRoot().lookupType("IntMessage");

    expectThrow(test, Msg, "int32Val", "abc",         "Int32FieldNotNumber (\"abc\")");
    expectThrow(test, Msg, "int32Val", "3x3",         "Int32FieldNotNumber (\"3x3\")");
    expectThrow(test, Msg, "int32Val", "12abc",       "Int32FieldStringValuePartiallyNumeric");
    expectThrow(test, Msg, "int32Val", "12 34",       "Int32FieldStringValuePartiallyNumericSpace");
    expectThrow(test, Msg, "int32Val", 0.5,           "Int32FieldNotInteger");
    expectThrow(test, Msg, "int32Val", 2147483648,    "Int32FieldTooLarge");
    expectThrow(test, Msg, "int32Val", -2147483649,   "Int32FieldTooSmall");
    expectThrow(test, Msg, "int32Val", "",            "Int32FieldEmptyString");
    expectThrow(test, Msg, "int32Val", " 1",          "Int32FieldLeadingSpace");
    expectThrow(test, Msg, "int32Val", "1 ",          "Int32FieldTrailingSpace");
    expectThrow(test, Msg, "int32Val", true,          "Int32 boolean");
    expectThrow(test, Msg, "int32Val", NaN,           "Int32 NaN");

    // Valid inputs should still work.
    test.equal(Msg.fromObject({ int32Val: 0 }).int32Val,            0,          "int32 zero");
    test.equal(Msg.fromObject({ int32Val: 2147483647 }).int32Val,   2147483647, "int32 max");
    test.equal(Msg.fromObject({ int32Val: -2147483648 }).int32Val, -2147483648, "int32 min");
    test.equal(Msg.fromObject({ int32Val: "-7" }).int32Val,         -7,         "int32 string");
    test.equal(Msg.fromObject({ int32Val: 1e5 }).int32Val,          100000,     "int32 exponential");

    // Same rules apply to sint32 and sfixed32.
    expectThrow(test, Msg, "sint32Val",   "abc", "Sint32FieldNotNumber");
    expectThrow(test, Msg, "sfixed32Val", "abc", "Sfixed32FieldNotNumber");

    test.end();
});

tape.test("JSON integer strict parsing - uint64", function(test) {
    var Msg = makeRoot().lookupType("IntMessage");

    expectThrow(test, Msg, "uint64Val", "abc",                    "Uint64FieldNotNumber (\"abc\")");
    expectThrow(test, Msg, "uint64Val", "3x3",                    "Uint64FieldNotNumber (\"3x3\")");
    expectThrow(test, Msg, "uint64Val", "0.5",                    "Uint64FieldNotInteger");
    expectThrow(test, Msg, "uint64Val", "18446744073709551616",   "Uint64FieldTooLarge");
    expectThrow(test, Msg, "uint64Val", "-1",                     "Uint64 negative string");
    expectThrow(test, Msg, "uint64Val", -1,                       "Uint64 negative number");
    expectThrow(test, Msg, "uint64Val", "",                       "Uint64FieldEmptyString");
    expectThrow(test, Msg, "uint64Val", " 1",                     "Uint64 leading space");
    expectThrow(test, Msg, "uint64Val", "1 ",                     "Uint64 trailing space");
    expectThrow(test, Msg, "uint64Val", true,                     "Uint64 boolean");
    expectThrow(test, Msg, "uint64Val", NaN,                      "Uint64 NaN");
    expectThrow(test, Msg, "uint64Val", Infinity,                 "Uint64 Infinity");

    // Valid uint64 inputs.
    var v = Msg.fromObject({ uint64Val: "18446744073709551615" }).uint64Val;
    test.equal(v.toString(), "18446744073709551615", "uint64 max as string");

    // MaxValueNotQuoted: 18446744073709549568 is the largest uint64
    // exactly representable as IEEE-754 double. JSON parsers must accept
    // this unquoted form.
    var n = Msg.fromObject({ uint64Val: 18446744073709549568 }).uint64Val;
    test.equal(n.toString(), "18446744073709549568", "uint64 max-representable not quoted");

    test.equal(Msg.fromObject({ uint64Val: 0 }).uint64Val.toString(),    "0",   "uint64 zero");
    test.equal(Msg.fromObject({ uint64Val: "42" }).uint64Val.toString(), "42",  "uint64 quoted");
    test.equal(Msg.fromObject({ uint64Val: 42 }).uint64Val.toString(),   "42",  "uint64 unquoted");

    test.end();
});

tape.test("JSON integer strict parsing - int64", function(test) {
    var Msg = makeRoot().lookupType("IntMessage");

    expectThrow(test, Msg, "int64Val", "abc",                   "Int64FieldNotNumber (\"abc\")");
    expectThrow(test, Msg, "int64Val", "3x3",                   "Int64FieldNotNumber (\"3x3\")");
    expectThrow(test, Msg, "int64Val", "0.5",                   "Int64FieldNotInteger");
    expectThrow(test, Msg, "int64Val", "9223372036854775808",   "Int64FieldTooLarge");
    expectThrow(test, Msg, "int64Val", "-9223372036854775809",  "Int64FieldTooSmall");
    expectThrow(test, Msg, "int64Val", "",                      "Int64FieldEmptyString");
    expectThrow(test, Msg, "int64Val", " 1",                    "Int64 leading space");
    expectThrow(test, Msg, "int64Val", "1 ",                    "Int64 trailing space");
    expectThrow(test, Msg, "int64Val", true,                    "Int64 boolean");
    expectThrow(test, Msg, "int64Val", NaN,                     "Int64 NaN");

    // Valid int64 inputs.
    test.equal(Msg.fromObject({ int64Val: "9223372036854775807" }).int64Val.toString(),
               "9223372036854775807", "int64 max as string");
    test.equal(Msg.fromObject({ int64Val: "-9223372036854775808" }).int64Val.toString(),
               "-9223372036854775808", "int64 min as string");
    test.equal(Msg.fromObject({ int64Val: 0 }).int64Val.toString(),  "0",  "int64 zero");
    test.equal(Msg.fromObject({ int64Val: -7 }).int64Val.toString(), "-7", "int64 unquoted negative");

    // Same for sint64 / sfixed64 / fixed64.
    expectThrow(test, Msg, "sint64Val",   "abc", "Sint64FieldNotNumber");
    expectThrow(test, Msg, "sfixed64Val", "abc", "Sfixed64FieldNotNumber");
    expectThrow(test, Msg, "fixed64Val",  "abc", "Fixed64FieldNotNumber");
    expectThrow(test, Msg, "fixed64Val",  -1,    "Fixed64 negative");

    test.end();
});
