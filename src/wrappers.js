"use strict";

/**
 * Wrappers for common types.
 * @type {Object.<string,IWrapper>}
 * @const
 */
var wrappers = exports;

var Message = require("./message"),
    util    = require("./util/minimal");

function typeNameFromAnyUrl(typeUrl) {
    var slash = typeUrl.lastIndexOf("/");
    if (slash <= 0 || slash === typeUrl.length - 1)
        throw Error("invalid Any type URL: " + typeUrl);
    var name = typeUrl.substring(slash + 1);
    if (name.charAt(0) === ".")
        throw Error("invalid Any type URL: " + typeUrl);
    return name;
}

function lookupAnyType(root, typeUrl) {
    var name = typeNameFromAnyUrl(typeUrl);
    return root.lookupType(name);
}

/**
 * From object converter part of an {@link IWrapper}.
 * @typedef WrapperFromObjectConverter
 * @type {function}
 * @param {Object.<string,*>} object Plain object
 * @returns {Message<{}>} Message instance
 * @this Type
 */

/**
 * To object converter part of an {@link IWrapper}.
 * @typedef WrapperToObjectConverter
 * @type {function}
 * @param {Message<{}>} message Message instance
 * @param {IConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 * @this Type
 */

/**
 * Common type wrapper part of {@link wrappers}.
 * @interface IWrapper
 * @property {WrapperFromObjectConverter} [fromObject] From object converter
 * @property {WrapperToObjectConverter} [toObject] To object converter
 */

// Custom wrapper for Any
wrappers[".google.protobuf.Any"] = {

    fromObject: function(object, depth) {

        // unwrap value type if mapped
        if (object && object["@type"]) {
            var type = lookupAnyType(this.root, object["@type"]);
            return this.create({
                type_url: object["@type"],
                value: type.encode(type.fromObject(object, depth === undefined ? 1 : depth + 1)).finish()
            });
        }

        return this.fromObject(object, depth);
    },

    toObject: function(message, options, depth) {
        if (depth === undefined)
            depth = 0;
        if (depth > util.recursionLimit)
            throw Error("max depth exceeded");

        // Default prefix
        var googleApi = "type.googleapis.com/";
        var prefix = "";
        // decode value if requested and unmapped
        if (options && options.json && message.type_url && message.value) {
            // Separate the prefix used
            prefix = message.type_url.substring(0, message.type_url.lastIndexOf("/") + 1);
            var type = lookupAnyType(this.root, message.type_url);
            message = type.decode(message.value, undefined, undefined, depth + 1);
        }

        // wrap value if unmapped
        if (!(message instanceof this.ctor) && message instanceof Message) {
            var object = message.$type.toObject(message, options, depth + 1);
            var messageName = message.$type.fullName[0] === "." ?
                message.$type.fullName.slice(1) : message.$type.fullName;
            // Default to type.googleapis.com prefix if no prefix is used
            if (prefix === "") {
                prefix = googleApi;
            }
            var name = prefix + messageName;
            object["@type"] = name;
            return object;
        }

        return this.toObject(message, options, depth);
    }
};
