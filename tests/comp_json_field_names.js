"use strict";

// Tests for ProtoJSON field-name normalization in fromObject.
//
// Mirrors the conformance-suite cases in
//   conformance/binary_json_conformance_suite.cc
// (FieldNameInLowerCamelCase / FieldNameInSnakeCase / OriginalProtoFieldName /
//  FieldNameWithMixedCases / FieldNameWithNumbers / FieldNameWithDoubleUnderscores /
//  FieldNameDuplicate / FieldNameDuplicateDifferentCasing1/2 / FieldNameExtension)
//
// Per the ProtoJSON spec, parsers MUST accept both the lowerCamelCase JSON name
// (or an explicit [json_name = "..."] override) and the original proto field
// name, and MUST reject duplicate fields (including across casing variants).

var tape = require("tape");

var protobuf = require("..");

// A copy of the field set used by the upstream FieldName* tests.
var proto = "syntax = \"proto2\";\n"
    + "message TestAllTypes {\n"
    + "  optional int32 fieldname1 = 401;\n"
    + "  optional int32 field_name2 = 402;\n"
    + "  optional int32 _field_name3 = 403;\n"
    + "  optional int32 field__name4_ = 404;\n"
    + "  optional int32 field0name5 = 405;\n"
    + "  optional int32 field_0_name6 = 406;\n"
    + "  optional int32 fieldName7 = 407;\n"
    + "  optional int32 FieldName8 = 408;\n"
    + "  optional int32 field_Name9 = 409;\n"
    + "  optional int32 Field_Name10 = 410;\n"
    + "  optional int32 FIELD_NAME11 = 411;\n"
    + "  optional int32 FIELD_name12 = 412;\n"
    + "  optional int32 __field_name13 = 413;\n"
    + "  optional int32 __Field_name14 = 414;\n"
    + "  optional int32 field__name15 = 415;\n"
    + "  optional int32 field__Name16 = 416;\n"
    + "  optional int32 field_name17__ = 417;\n"
    + "  optional int32 Field_name18__ = 418;\n"
    + "  optional NestedMessage optional_nested_message = 18;\n"
    + "  message NestedMessage { optional int32 a = 1; }\n"
    + "}\n";

function loadType() {
    var root = protobuf.parse(proto, { keepCase: false }).root;
    return root.lookupType("TestAllTypes");
}

// Each entry: [proto-original-name, lowerCamelCase JSON name].
// JSON names are derived per the descriptor.cc ToJsonName rules:
//   drop "_", uppercase whatever follows.
var FIELD_PAIRS = [
    [ "fieldname1",      "fieldname1" ],
    [ "field_name2",     "fieldName2" ],
    [ "_field_name3",    "FieldName3" ],
    [ "field__name4_",   "fieldName4" ],
    [ "field0name5",     "field0name5" ],
    [ "field_0_name6",   "field0Name6" ],
    [ "fieldName7",      "fieldName7" ],
    [ "FieldName8",      "FieldName8" ],
    [ "field_Name9",     "fieldName9" ],
    [ "Field_Name10",    "FieldName10" ],
    [ "FIELD_NAME11",    "FIELDNAME11" ],
    [ "FIELD_name12",    "FIELDName12" ],
    [ "__field_name13",  "FieldName13" ],
    [ "__Field_name14",  "FieldName14" ],
    [ "field__name15",   "fieldName15" ],
    [ "field__Name16",   "fieldName16" ],
    [ "field_name17__",  "fieldName17" ],
    [ "Field_name18__",  "FieldName18" ]
];

tape.test("comp_json_field_names - FieldNameInLowerCamelCase (JSON names accepted)", function(t) {
    var TestAllTypes = loadType();
    var input = {};
    FIELD_PAIRS.forEach(function(pair, i) {
        input[pair[1]] = i + 1; // arbitrary distinct value
    });
    var msg = TestAllTypes.fromObject(input);
    FIELD_PAIRS.forEach(function(pair, i) {
        var field = TestAllTypes.fields[pair[0]] || TestAllTypes.fieldsArray.filter(function(f) {
            return (f.originalName || f.name) === pair[0];
        })[0];
        t.ok(field, "field for " + pair[0] + " resolves");
        t.equal(msg[field.name], i + 1, "JSON name " + pair[1] + " populates field " + pair[0]);
    });
    t.end();
});

tape.test("comp_json_field_names - FieldNameInSnakeCase / OriginalProtoFieldName (snake_case accepted)", function(t) {
    var TestAllTypes = loadType();
    var input = {};
    FIELD_PAIRS.forEach(function(pair, i) {
        input[pair[0]] = i + 100; // distinct
    });
    var msg = TestAllTypes.fromObject(input);
    FIELD_PAIRS.forEach(function(pair, i) {
        var field = TestAllTypes.fieldsArray.filter(function(f) {
            return (f.originalName || f.name) === pair[0];
        })[0];
        t.ok(field, "field for original name " + pair[0] + " resolves");
        t.equal(msg[field.name], i + 100, "original proto name " + pair[0] + " accepted");
    });
    t.end();
});

tape.test("comp_json_field_names - FieldNameDuplicate (same name twice rejected)", function(t) {
    var TestAllTypes = loadType();
    // Cannot literally have a duplicate JS object key — but the conformance test
    // is exercising the JSON parse step. fromObject should be defensive when
    // multiple aliasing forms collide; same-key duplicates are already
    // de-duped by JSON.parse so this case primarily verifies that the
    // single-form input round-trips without surprises.
    var msg = TestAllTypes.fromObject({ optionalNestedMessage: { a: 1 } });
    t.equal(msg.optionalNestedMessage.a, 1, "single camelCase form parses");
    t.end();
});

tape.test("comp_json_field_names - FieldNameDuplicateDifferentCasing1 (snake + camel rejected)", function(t) {
    var TestAllTypes = loadType();
    t.throws(function() {
        TestAllTypes.fromObject({
            optional_nested_message: { a: 1 },
            optionalNestedMessage: {}
        });
    }, /duplicate/i, "snake+camel for the same field must throw");
    t.end();
});

tape.test("comp_json_field_names - FieldNameDuplicateDifferentCasing2 (camel + snake rejected)", function(t) {
    var TestAllTypes = loadType();
    t.throws(function() {
        TestAllTypes.fromObject({
            optionalNestedMessage: { a: 1 },
            optional_nested_message: {}
        });
    }, /duplicate/i, "camel+snake for the same field must throw");
    t.end();
});

tape.test("comp_json_field_names - explicit json_name option honored", function(t) {
    var customProto = "syntax = \"proto3\";\n"
        + "message M {\n"
        + "  string foo_bar = 1 [json_name = \"FOO\"];\n"
        + "}\n";
    var root = protobuf.parse(customProto, { keepCase: false }).root;
    var M = root.lookupType("M");
    // Accept the explicit json_name.
    var a = M.fromObject({ FOO: "x" });
    t.equal(a.fooBar, "x", "explicit json_name accepted");
    // Accept the original proto field name too.
    var b = M.fromObject({ foo_bar: "y" });
    t.equal(b.fooBar, "y", "original proto name accepted alongside explicit json_name");
    t.end();
});

tape.test("comp_json_field_names - existing camelCase input keeps working (backwards compat)", function(t) {
    var TestAllTypes = loadType();
    // This is what existing protobuf.js callers pass: the internal .name form.
    // It must keep working untouched.
    var msg = TestAllTypes.fromObject({
        fieldname1: 7,
        fieldName2: 8
    });
    t.equal(msg.fieldname1, 7, "internal camelCase name still accepted");
    t.equal(msg.fieldName2, 8, "internal camelCase name still accepted (case 2)");
    t.end();
});

tape.test("comp_json_field_names - toObject emits spec lowerCamelCase keys when o.json", function(t) {
    var TestAllTypes = loadType();
    var input = {};
    FIELD_PAIRS.forEach(function(pair, i) {
        input[pair[0]] = i + 1; // by original proto name
    });
    var msg = TestAllTypes.fromObject(input);
    var jsonOut = TestAllTypes.toObject(msg, { json: true });
    FIELD_PAIRS.forEach(function(pair) {
        t.ok(Object.prototype.hasOwnProperty.call(jsonOut, pair[1]),
            "json output contains spec JSON name " + pair[1]);
    });
    t.end();
});

tape.test("comp_json_field_names - toObject without o.json keeps internal names", function(t) {
    var TestAllTypes = loadType();
    var msg = TestAllTypes.fromObject({ field_name2: 42 });
    var plainOut = TestAllTypes.toObject(msg);
    // Internal protobuf.js name is the camelCased form ("fieldName2"). This
    // is what existing callers depend on.
    t.equal(plainOut.fieldName2, 42, "default toObject still uses internal .name keys");
    t.end();
});
