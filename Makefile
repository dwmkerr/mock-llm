.PHONY: test chart-snapshot

chart-snapshot:
	helm template test-chart chart -f ./chart/test-values.yaml &> ./chart/snapshots/output.yaml

chart-test-snapshot:
	helm template test-chart chart -f ./chart/test-values.yaml | diff ./chart/snapshots/output.yaml -

test:
	make chart-test-snapshot