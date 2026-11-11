{
  description = "audimance";

  # Nixpkgs / NixOS version to use.
  inputs.nixpkgs.url = "nixpkgs/nixos-26.05";

  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs =
    {
      self,
      flake-utils,
      nixpkgs,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        # Generate a user-friendly version number.
        version = builtins.substring 0 8 self.lastModifiedDate;
        src = ./.;

        pkgs = nixpkgs.legacyPackages.${system};

        buildInputs = with pkgs; [
          gci
          git
          gofumpt
          golangci-lint
          pkgLint
        ];

        nativeBuildInputs = with pkgs; [
          esbuild
          go
          nodejs_26
        ];

        pkgLint = pkgs.writeScriptBin "lint" ''
          ${pkgs.nodejs_26}/bin/npm run build &&
          golangci-lint run ./
        '';
      in
      {
        # On macOS, mkShell breaks /usr/bin/git.
        devShells.default = (if pkgs.stdenv.hostPlatform.isDarwin then pkgs.mkShellNoCC else pkgs.mkShell) {
          inherit
            buildInputs
            nativeBuildInputs
            src
            system
            ;
        };

        # Provide some binary packages for selected system types.
        packages = {
          app = pkgs.buildNpmPackage {
            pname = "audimance-app";
            inherit
              nativeBuildInputs
              src
              system
              version
              ;

            vendorHash = "sha256-Up6pjR9C2Z5wX6yLnEytdqjGCqKMCbLUvEzTZIMN8sU=";
            npmDepsHash = "sha256-6dDY4qR40LYpcVA8lkhSc3McupBpkYAOK8eDS35/Fvo=";
            npmDepsFetcherVersion = 2;
          };

          default = pkgs.buildGoModule {
            pname = "audimance";
            inherit src system version;

            buildInputs = [ self.packages.${system}.app ];
            nativeBuildInputs = [
              pkgs.goreleaser
            ];

            preBuild = ''
              mkdir app
              cp -r ${self.packages.${system}.app}/lib/node_modules/audimance-app/app/* app/
            '';

            vendorHash = "sha256-9gJUGBe5iwQvqLJj2vT8YNGXyDY6pqc3HqYrHqPfc2E";
          };

        };

      }
    )
    // {
      overlays.default = (
        final: prev: {
          audimance = self.packages.${prev.system}.default;
        }
      );
    };

}
