# Helm Chart Documentation

This guide covers deploying mock-llm to Kubernetes using Helm.

## Installation

Install from the OCI registry:

```bash
helm install mock-llm oci://ghcr.io/dwmkerr/charts/mock-llm --version 0.1.8
```

Verify the deployment:

```bash
kubectl get deployment mock-llm
kubectl get service mock-llm
```

Test the service:

```bash
kubectl port-forward svc/mock-llm 6556:6556 &
curl -X POST http://localhost:6556/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Configuration

### Custom Mock Rules

Configure custom responses via `values.yaml`:

```yaml
# Optional additional mock-llm configuration.
config:
  rules:
    - path: "/v1/chat/completions"
      match: "contains(messages[-1].content, 'hello')"
      response:
        status: 200
        content: |
          {
            "choices": [{
              "message": {
                "role": "assistant",
                "content": "Hi there!"
              },
              "finish_reason": "stop"
            }]
          }
```

Install with custom configuration:

```bash
helm install mock-llm oci://ghcr.io/dwmkerr/charts/mock-llm \
  --values custom-values.yaml
```

### Using Existing ConfigMap

If you manage your configuration separately:

```yaml
# Use existing ConfigMap (must contain key 'mock-llm.yaml')
existingConfigMap: "my-custom-config"
```

## Installing on Ark

[Ark](https://github.com/mckinsey/agents-at-scale-ark) is an agentic AI platform for Kubernetes. Mock-llm can be used with Ark's Model CRD. This is useful for:

- Deterministic testing
- Testing error scenarios
- Understanding values sent to the LLM (e.g. expanded parameters etc)
- Eliminating costs
- Eliminating inference time for tests

To install the Ark model, the Ark CRDs must be installed. Check the [Ark Documentation](https://mckinsey.github.io/agents-at-scale-ark/) for details

Example: Create an Azure OpenAI model pointing to mock-llm:

```yaml
# values.yaml
ark:
  model:
    enabled: true
    name: "gpt-5"
    type: "azure"
    model: "gpt-5"
    pollInterval: "3s"
    apiKey: "mock-api-key"
```

Custom headers can be added to test header resolution:

```yaml
ark:
  model:
    enabled: true
    name: "gpt-5"
    type: "azure"
    model: "gpt-5"
    headers:
    - name: X-Custom-Header
      value:
        value: "static-value"
    - name: X-Secret-Header
      value:
        valueFrom:
          secretKeyRef:
            name: my-secret
            key: token
```

This creates an Ark Model CRD that points to the mock-llm service. Agents can then reference this model for testing.

Mock-llm supports mocking OpenAI, Azure OpenAI, and AWS Bedrock model types. See the [Ark examples](https://github.com/mckinsey/agents-at-scale/tree/main/tests) for more usage patterns.

## Chart Values

Key configuration options:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `1` |
| `image.repository` | Container image repository | `ghcr.io/dwmkerr/mock-llm` |
| `image.tag` | Container image tag | Chart appVersion |
| `service.type` | Kubernetes service type | `ClusterIP` |
| `service.port` | Service port | `6556` |
| `config` | Mock LLM configuration rules | `nil` (uses defaults) |
| `existingConfigMap` | Use existing ConfigMap for config | `""` |
| `ark.model.enabled` | Create Ark `model` resource (requires Ark CRDs to be installed) | `false` |
| `ark.model.name` | Model name | `"gpt-5"` |
| `ark.model.type` | Model type (openai/azure/bedrock) | `"openai"` |
| `ark.model.model` | Model identifier | `"gpt-5"` |
| `ark.model.headers` | Custom HTTP headers (supports valueFrom) | `[]` |
| `ark.model.apiVersion` | API version (Azure only) | `"2024-12-01-preview"` |
| `ark.model.baseUrl` | Base URL override (auto-generated if empty) | `""` |

See [values.yaml](../chart/values.yaml) for all available options.

## Uninstalling

Remove the release:

```bash
helm uninstall mock-llm
```
