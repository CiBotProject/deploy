
/**
 * Encode the given parameter using base64 scheme.
 * 
 * @param {*} decoded_content content to encode.
 */
function encodeBase64(decoded_content)
{
    return Buffer.from(decoded_content).toString('base64');
}

/**
 * Decode the given parameter using base64 scheme.
 * 
 * @param {*} encoded_content content to decode.
 */
function decodeBase64(encoded_content)
{
    return Buffer.from(encoded_content, 'base64').toString();
}

exports.encodeBase64 = encodeBase64
exports.decodeBase64 = decodeBase64