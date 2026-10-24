import { getAddress, verifyMessage } from 'viem';
import { ok } from '../../server/errors.ts';
import { ApiError, withApi } from '../../server/http.ts';
import { nonceIssuedAt, sessionCookie, signInMessage, signJwt } from '../../server/session.ts';
import { parseJson } from '../../server/validate.ts';

export const POST = withApi(async (request) => {
    const { address, message, signature } = await parseJson(request);
    if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new ApiError(400, 'invalid_address');
    if (typeof message !== 'string' || typeof signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signature)) throw new ApiError(401, 'invalid_signature');
    const nonce = /\nNonce: ([A-Za-z0-9_-]+)\n/.exec(message)?.[1];
    const issued = nonce ? nonceIssuedAt(nonce) : null;
    // The message must be exactly the one we issued for this address.
    if (!nonce || issued === null || message !== signInMessage(address, nonce, issued)) throw new ApiError(401, 'invalid_signature');
    const valid = await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` }).catch(() => false);
    if (!valid) throw new ApiError(401, 'invalid_signature');
    return ok({ ok: true }, { headers: { 'set-cookie': sessionCookie(signJwt(getAddress(address))) } });
});
