.PHONY: install build test run ts-clean

ts_flags = --project tsconfig.json

ts-compile:
	@tsc $(ts_flags) $?

ts-compile-watch:
	@tsc -w $(ts_flags) $?

run: ts-compile
	go run .