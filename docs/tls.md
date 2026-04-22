# HTTPS / TLS

Mock-LLM serves plain HTTP by default. TLS is opt-in.

## When to enable

- Any in-cluster test that exercises a client with strict HTTPS enforcement. Notable example: the Go MCP SDK (`github.com/modelcontextprotocol/go-sdk/oauthex`) rejects non-HTTPS, non-loopback metadata URLs with no escape hatch.
- Any environment that forbids HTTP traffic between pods.
- Smoke-testing clients against real certificate validation paths.

If your only consumer is the TypeScript MCP SDK on loopback, plain HTTP is fine. TLS adds fixture complexity (cert distribution, trust bundles) that you do not need for loopback tests.

## How mock-llm reads TLS config

**Mock-llm never generates or discovers certificates.** The caller supplies paths, mock-llm reads the files, done. Same pattern as nginx, caddy, etcd, kubelet.

Two input surfaces, environment variables take precedence over the config file:

**Environment variables** (twelve-factor, used by the Helm chart):

```bash
MOCK_LLM_TLS_ENABLED=true
MOCK_LLM_TLS_CERT=/etc/mock-llm/tls/tls.crt
MOCK_LLM_TLS_KEY=/etc/mock-llm/tls/tls.key
```

**Config file** (`mock-llm.yaml`, for local dev):

```yaml
tls:
  enabled: true
  certPath: ./scratch/mock-llm.crt
  keyPath: ./scratch/mock-llm.key
```

`tls.enabled=true` without both paths is a startup error — fail fast, no implicit defaults.

## Local development

Generate a self-signed cert once:

```bash
mkdir -p ./scratch
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout ./scratch/mock-llm.key \
  -out ./scratch/mock-llm.crt \
  -days 365 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

Point mock-llm at it and run:

```yaml
# mock-llm.yaml
tls:
  enabled: true
  certPath: ./scratch/mock-llm.crt
  keyPath: ./scratch/mock-llm.key
```

```bash
mock-llm
# mock-llm vX.Y.Z server running on https://0.0.0.0:6556
curl --cacert ./scratch/mock-llm.crt https://localhost:6556/health
```

## Kubernetes / Helm

The chart generates a self-signed cert via Helm's built-in `genSelfSignedCert` and emits two resources:

- `Secret {fullname}-tls` (type `kubernetes.io/tls`) — private key + cert, mounted into the mock-llm pod at `/etc/mock-llm/tls/`.
- `ConfigMap {fullname}-ca` — just the public cert, for consumers to mount as a trust bundle.

```bash
helm install mock-llm ./chart --set tls.enabled=true
```

The generated cert carries Subject Alternative Names covering the chart-derived in-cluster DNS names:

- `{fullname}`
- `{fullname}.{namespace}`
- `{fullname}.{namespace}.svc`
- `{fullname}.{namespace}.svc.cluster.local`
- `localhost`
- `127.0.0.1`

Add more with `tls.extraSANs`.

### Consumer-side trust

A pod that needs to trust mock-llm mounts the CA ConfigMap and points `SSL_CERT_FILE` at it:

```yaml
# consumer-deployment.yaml
spec:
  template:
    spec:
      containers:
        - name: my-consumer
          env:
            - name: SSL_CERT_FILE
              value: /etc/mock-llm/ca/ca.crt
          volumeMounts:
            - name: mock-llm-ca
              mountPath: /etc/mock-llm/ca
              readOnly: true
      volumes:
        - name: mock-llm-ca
          configMap:
            name: mock-llm-ca
```

Go's `net/http` default transport honours `SSL_CERT_FILE`. Most language runtimes do too.

### Bring your own cert (cert-manager)

```yaml
# values.yaml
tls:
  enabled: true
  existingSecret: mock-llm-cert-manager-tls
  existingCAConfigMap: mock-llm-cert-manager-ca
```

When both are set the chart does not generate a cert and mounts the named resources instead.

## Cert rotation

`genSelfSignedCert` produces a new cert on every `helm install` / `helm upgrade`. Pods restart, consumers re-read the ConfigMap. Fine for fixtures; use cert-manager for anything longer-lived.

## Non-goals

- Mutual TLS. Not part of the MCP auth spec.
- Real CA-signed certs (use cert-manager instead, see above).
- Runtime cert generation. Chart / local tooling does that, mock-llm just reads files.
