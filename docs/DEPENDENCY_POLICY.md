# Dependency Policy

- Production dependencies are pinned to exact versions and committed with a lockfile.
- Major upgrades are reviewed deliberately; they are not performed merely because a newer major exists.
- CI uses `npm ci` once the lockfile exists.
- Security or compatibility updates are tested in CI before merging.
- The current stack is intentionally frozen during the hardening/validation phase.