import * as jose from "jose";

export class CryptoService {
  /**
   * Tries to decode a standard JWT (Base64 parts)
   * This remains useful for non-encrypted tokens (JWS).
   */
  static decodeJWT(token) {
    try {
      const claims = jose.decodeJwt(token);
      return JSON.stringify(claims, null, 2);
    } catch (e) {
      return null;
    }
  }

  /**
   * Decrypts JWE using the 'jose' library.
   * Auto-detects algorithm from the token header.
   * @param {string} token
   * @param {string} keyInput - The key string (plain text or base64)
   * @param {boolean} isBase64 - Whether to treat the key as Base64
   * @returns {Promise<{output: string, debug: string}>}
   */
  static async decryptJWE(token, keyInput, isBase64 = false) {
    let debugLog = "";
    if (!keyInput || !keyInput.trim()) {
      return {
        output: "Error: No secret key provided.",
        debug: debugLog,
      };
    }

    try {
      let secretKey;

      if (isBase64) {
        try {
          let cleanKey = keyInput.trim().replace(/-/g, "+").replace(/_/g, "/");
          while (cleanKey.length % 4) {
            cleanKey += "=";
          }

          const binaryStr = atob(cleanKey);
          secretKey = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            secretKey[i] = binaryStr.charCodeAt(i);
          }

          debugLog += `Key Mode: Base64 (Length: ${secretKey.length} bytes)\n`;
        } catch (e) {
          return {
            output: `Error: Invalid Base64 key string. Details: ${e.message}`,
            debug: debugLog,
          };
        }
      } else {
        const encoder = new TextEncoder();
        secretKey = encoder.encode(keyInput);
        debugLog += `Key Mode: UTF-8 String (Length: ${secretKey.length} bytes)\n`;
      }

      const header = this.getTokenHeader(token);
      if (header) {
        debugLog += `Token Algorithm: ${header.alg}\n`;
        debugLog += `Token Encryption: ${header.enc}\n`;
      }

      const { plaintext } = await jose.compactDecrypt(token, secretKey);
      const result = new TextDecoder().decode(plaintext);

      let finalOutput = result;
      try {
        finalOutput = JSON.stringify(JSON.parse(result), null, 2);
      } catch (e) {}

      return { output: finalOutput, debug: debugLog };
    } catch (e) {
      console.error("Decryption failed:", e);

      let errorMsg = `Error: ${e.message}`;

      if (
        e.code === "ERR_JWE_INVALID" ||
        e.message.includes("decryption operation failed")
      ) {
        errorMsg += "\n(Cause: Key mismatch or invalid tag)";
      } else if (
        e.code === "ERR_JWE_INVALID_KEY_LENGTH" ||
        e.message.includes("Key length")
      ) {
        errorMsg +=
          "\n(Cause: The key length does not match the algorithm requirements)";
      }

      return { output: errorMsg, debug: debugLog };
    }
  }

  static getTokenHeader(token) {
    try {
      return jose.decodeProtectedHeader(token);
    } catch (e) {
      return null;
    }
  }
}
