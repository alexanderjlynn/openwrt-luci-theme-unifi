# Releasing

The release workflow builds an architecture-independent APK with the official
OpenWrt 25.12.5 SDK and publishes a signed single-package repository.

## One-time signing key setup

Generate an ECDSA P-256 key on a trusted workstation:

```sh
mkdir -m 0700 .release-keys
openssl ecparam -name prime256v1 -genkey -noout \
  -out .release-keys/openwrt-unifi-private-key.pem
chmod 0600 .release-keys/openwrt-unifi-private-key.pem
openssl ec -in .release-keys/openwrt-unifi-private-key.pem -pubout \
  -out .release-keys/openwrt-unifi-public-key.pem
```

Store the complete private PEM as the GitHub Actions repository secret
`APK_PRIVATE_KEY`. Keep an encrypted offline backup. Never commit the private
key. Losing it means existing routers cannot verify the next index without a
key-rotation bootstrap.

## Publish

1. Update `PKG_VERSION` in `Makefile`.
2. Update release notes and run `./scripts/check.sh`.
3. Commit, then tag the same version as `v<PKG_VERSION>`.
4. Push the tag.
5. Confirm the GitHub release contains one APK, `packages.adb`, the public key,
   its digest, and `SHA256SUMS`.
6. Test a clean installation from the `releases/latest/download` URLs.
7. Confirm that the public-key digest in the README install snippet matches the
   digest published with the release. A signing-key rotation requires updating
   both the GitHub secret and this pinned digest before tagging.

The index is signed and the individual APK is also signed. The public key name
is deliberately unique so it does not overwrite OpenWrt's own package key.
