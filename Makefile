NAME = $(shell npm pkg get name | tr -d '"')
VERSION = $(shell npm pkg get version | tr -d '"')

PKGFILE = $(NAME).kwinscript
PKGDIR = pkg

build: res src
	zip -r $(PKGFILE) $(PKGDIR)

$(PKGFILE): build

# install/uninstall/restart are handled by ./install.sh — keep this
# Makefile build-only so there is a single installation code path.
lint:
	npx tsc --noEmit
	npx eslint "src/**"

res: $(PKGDIR)
	cp -f res/metadata.json $(PKGDIR)/
	cp -f res/main.xml $(PKGDIR)/contents/config/
	cp -f res/config.ui $(PKGDIR)/contents/ui/
	cp -f res/main.js $(PKGDIR)/contents/code/
	sed -i "s/%VERSION%/$(VERSION)/" $(PKGDIR)/metadata.json
	sed -i "s/%NAME%/$(NAME)/" $(PKGDIR)/metadata.json

src: tessera.mjs $(PKGDIR)
	mv -f tessera.mjs $(PKGDIR)/contents/code/main.mjs
	cp -f src/qml/* $(PKGDIR)/contents/ui/

# es2016 is pinned on purpose: KWin's QML JS engine does not parse newer
# syntax (e.g. ES2022 class static fields), so keep the bundle conservative.
# The README manual-build command must stay in sync with this target.
tessera.mjs:
	npm install
	npx esbuild --bundle src/index.ts --outfile=tessera.mjs --format=esm --platform=neutral --target=es2016

$(PKGDIR):
	mkdir -p $(PKGDIR)
	mkdir -p $(PKGDIR)/contents/code
	mkdir $(PKGDIR)/contents/config
	mkdir $(PKGDIR)/contents/ui

clean:
	rm -rf $(PKGDIR) $(PKGFILE) tessera.mjs