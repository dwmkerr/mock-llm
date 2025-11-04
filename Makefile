.PHONY: test chart-snapshot

# Filter out version-specific lines to avoid snapshot drift on version bumps
chart-snapshot:
	helm template test-chart chart -f ./chart/test-values.yaml | grep -v "helm.sh/chart:\|app.kubernetes.io/version:\|ghcr.io/dwmkerr/mock-llm:" > ./chart/snapshots/output.yaml

chart-test-snapshot:
	helm template test-chart chart -f ./chart/test-values.yaml | grep -v "helm.sh/chart:\|app.kubernetes.io/version:\|ghcr.io/dwmkerr/mock-llm:" | diff ./chart/snapshots/output.yaml -

test:
	make chart-test-snapshot