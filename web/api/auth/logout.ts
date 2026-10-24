import { ok } from '../../server/errors.ts';
import { withApi } from '../../server/http.ts';
import { clearCookie } from '../../server/session.ts';

export const POST = withApi(async () => ok({ ok: true }, { headers: { 'set-cookie': clearCookie() } }));
