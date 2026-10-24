import { ok } from '../../server/errors.ts';
import { ApiError, withApi } from '../../server/http.ts';
import { issueNonce } from '../../server/session.ts';

export const GET = withApi(async (request) => {
    const address = new URL(request.url).searchParams.get('address') ?? '';
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new ApiError(400, 'invalid_address');
    return ok(issueNonce(address));
});
