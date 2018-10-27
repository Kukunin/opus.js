browser: src/*.js node_modules/fast-sound/dist/fast-sound.min.js
	mkdir -p build/
	./node_modules/.bin/browserify \
		--global-transform browserify-shim \
		--bare \
		--no-detect-globals \
		. \
		> build/opus.js

clean:
	$(MAKE) -C libopus clean
	rm -f libopus/configure
	rm -rf build libopusbuild

.PHONY: clean browser default
