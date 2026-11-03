import assert from 'node:assert/strict';
import { accessToken, hasAccess, accessExpires, accessDestination, passwordMatches } from '../access-session.ts';

// Dummy test value only; never read or print a deployment's real password.
const password = 'TEST_ONLY_not_a_real_password';
const morning = Date.parse('2026-11-03T00:00:00+08:00');
const beforeMidnight = Date.parse('2026-11-03T23:59:59+08:00');
const midnight = Date.parse('2026-11-04T00:00:00+08:00');
const token = accessToken(password, morning);
assert(hasAccess(token, password, beforeMidnight));
assert(!hasAccess(token, password, midnight));
assert(!hasAccess(token, 'changed-test-password', morning));
assert(!hasAccess(`${token}tampered`, password, morning));
assert(!hasAccess(undefined, password, morning));
assert.equal(accessExpires(beforeMidnight).getTime(), midnight);
assert(passwordMatches(password, password));
assert(!passwordMatches('incorrect-test-input', password));
assert(!passwordMatches(null, password));
assert.equal(accessDestination('/work/dji-romo?test=1'), '/work/dji-romo?test=1');
for (const unsafe of ['//example.com', '/\\example.com', 'https://example.com', '/access', '/a/../access']) {
  assert.equal(accessDestination(unsafe), '/');
}
console.log('PASS daily session, midnight expiry, password rotation, tampering and safe redirects');
