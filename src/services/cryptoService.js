import * as jose from 'jose';

export class CryptoService {
  /**
   * Tries to decode a standard JWT (Base64 parts)
   * This remains useful for non-encrypted tokens.
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
   * @param {boolean} isBase64 - Whether to treat the key as Base64 and resize to 64 bytes
   * @returns {Promise<{output: string, debug: string}>}
   */
  static async decryptJWE(token, keyInput, isBase64 = false) {
    if (!keyInput || !keyInput.trim()) {
      return { output: "Error: No secret key provided. Please set it in Settings or Custom Key field.", debug: "" };
    }

    try {
      let secretKey;

      if (isBase64) {
        // Implementation of: ensureKeyLength(Base64.from(b64key).decode(), 64)
        try {
            let cleanKey = keyInput.trim().replace(/-/g, '+').replace(/_/g, '/');
            while (cleanKey.length % 4) {
                cleanKey += '=';
            }
            const binaryStr = atob(cleanKey);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }

            secretKey = new Uint8Array(64);
            if (bytes.length > 64) {
                secretKey.set(bytes.subarray(0, 64));
            } else {
                secretKey.set(bytes);
            }
        } catch (e) {
            return { output: `Error: Invalid Base64 key string. Details: ${e.message}`, debug: debugLog };
        }
      } else {
        const encoder = new TextEncoder();
        secretKey = encoder.encode(keyInput);
      }

      const { plaintext } = await jose.compactDecrypt(
        token,
        secretKey,
      );

      // 3. Return readable JSON
      const result = new TextDecoder().decode(plaintext);
      
      let finalOutput = result;
      try {
        finalOutput = JSON.stringify(JSON.parse(result), null, 2);
      } catch {
        // Return raw string
      }
      
      return { output: finalOutput, debug: "" };

    } catch (e) {
      console.error("Decryption failed:", e);
      let errorMsg = `Error: ${e.message}`;
      if (e.message.includes('decryption operation failed')) {
        errorMsg += "\n(The key might be incorrect or algorithm mismatch)";
      }
      return { output: errorMsg, debug: "" };
    }
  }

  /**
   * Peeks at the token header to show algorithm info.
   */
  static getTokenHeader(token) {
      try {
          return jose.decodeProtectedHeader(token);
      } catch (e) {
          return null;
      }
  }
}
