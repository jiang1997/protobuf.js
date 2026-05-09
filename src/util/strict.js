"use strict";
var strict = exports;

// Strict numeric parsers for Type.prototype.fromJSON.
//
// These helpers enforce ProtoJSON spec rules for bare scalar Int/Uint
// fields and reject malformed input rather than silently coercing:
//   - JSON number grammar only (no whitespace, "+", leading zeros,
//     hex, NaN, Infinity)
//   - exponential and fractional forms accepted iff they resolve to
//     an integer in range (e.g. "1e3", "1.5e3", "100.0")
//   - explicit range checks (no silent wrap from `|0` / `>>> 0`)
//   - 64-bit overflow detection via Long round-trip (for plain
//     integer strings, where the input is exact)
//
// Long.js is injected lazily by src/util.js once the long module loads.

var Long;

// JSON number forms (signed / unsigned).
// Anchored, decimal-only, optional fraction, optional exponent.
var JSON_NUM_PATTERN  = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/;
var JSON_UNUM_PATTERN = /^(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/;

var INT32_MIN = -2147483648;
var INT32_MAX = 2147483647;
var UINT32_MAX = 4294967295;
var SAFE_INT_LIMIT = 9007199254740992; // 2^53

strict._setLong = function(L) {
    Long = L;
};

function fail(value, fieldPath) {
    throw Error("invalid value for field " + fieldPath + ": " + JSON.stringify(value));
}

function isExpOrFrac(s) {
    return s.indexOf("e") >= 0 || s.indexOf("E") >= 0 || s.indexOf(".") >= 0;
}

strict.int32 = function strict_int32(value, fieldPath) {
    var n;
    if (typeof value === "number") {
        if (!isFinite(value) || Math.floor(value) !== value)
            fail(value, fieldPath);
        n = value;
    } else if (typeof value === "string") {
        if (!JSON_NUM_PATTERN.test(value))
            fail(value, fieldPath);
        n = Number(value);
        if (!isFinite(n) || Math.floor(n) !== n)
            fail(value, fieldPath);
    } else {
        fail(value, fieldPath);
    }
    if (n < INT32_MIN || n > INT32_MAX)
        fail(value, fieldPath);
    return n;
};

strict.uint32 = function strict_uint32(value, fieldPath) {
    var n;
    if (typeof value === "number") {
        if (!isFinite(value) || Math.floor(value) !== value)
            fail(value, fieldPath);
        n = value;
    } else if (typeof value === "string") {
        if (!JSON_UNUM_PATTERN.test(value))
            fail(value, fieldPath);
        n = Number(value);
        if (!isFinite(n) || Math.floor(n) !== n)
            fail(value, fieldPath);
    } else {
        fail(value, fieldPath);
    }
    if (n < 0 || n > UINT32_MAX)
        fail(value, fieldPath);
    return n;
};

strict.int64 = function strict_int64(value, fieldPath, signed, asLong) {
    var stringValue, lng;
    var pattern = signed ? JSON_NUM_PATTERN : JSON_UNUM_PATTERN;
    var fromNumberInput = false;

    if (typeof value === "number") {
        if (!isFinite(value) || Math.floor(value) !== value)
            fail(value, fieldPath);
        // Beyond ±2^53 the JS double is already imprecise. Don't go through
        // String(value) — JS shortest-round-trip can pick a decimal that
        // matches a *different* int64 (e.g. 9223372036854774784 prints as
        // "9223372036854775000"). Use Long.fromNumber so the bit pattern of
        // the input double is preserved.
        fromNumberInput = true;
        stringValue = null;
    } else if (typeof value === "string") {
        if (!pattern.test(value))
            fail(value, fieldPath);
        if (isExpOrFrac(value)) {
            // Exponent or fraction: must resolve to a finite integer in
            // safe range; ambiguous at >2^53 because exponential form
            // can't represent every int64 exactly.
            var nm = Number(value);
            if (!isFinite(nm) || Math.floor(nm) !== nm)
                fail(value, fieldPath);
            if (nm > SAFE_INT_LIMIT || nm < -SAFE_INT_LIMIT)
                fail(value, fieldPath);
            stringValue = String(nm);
        } else {
            stringValue = value; // plain integer string: exact, deferred range check
        }
    } else {
        fail(value, fieldPath);
    }

    if (asLong && Long) {
        try {
            lng = fromNumberInput
                ? Long.fromNumber(value, !signed)
                : Long.fromString(stringValue, !signed);
        } catch (e) {
            fail(value, fieldPath);
        }
        // Round-trip detects silent wrap from Long.fromString, but only when
        // the source was an exact decimal string. Number inputs come straight
        // from Long.fromNumber, so the bit pattern is always faithful.
        if (!fromNumberInput
            && lng.toString() !== stringValue
            && !(stringValue === "-0" && lng.toString() === "0"))
            fail(value, fieldPath);
        if (!signed && lng.isNegative() && !fromNumberInput)
            fail(value, fieldPath);
        return lng;
    }

    var n = fromNumberInput ? value : Number(stringValue);
    if (!fromNumberInput && (n > SAFE_INT_LIMIT || n < -SAFE_INT_LIMIT))
        fail(value, fieldPath); // string source too large for Number representation
    return n;
};
