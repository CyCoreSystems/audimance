{
  description = "audimance";

  # Nixpkgs / NixOS version to use.
  inputs.nixpkgs.url = "nixpkgs/nixos-26.05";

  outputs =
    { self, nixpkgs }:
    let
      # Generate a user-friendly version number.
      version = builtins.substring 0 8 self.lastModifiedDate;

      # System types to support.
      supportedSystems = [
        "x86_64-linux"
        "x86_64-darwin"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      # Helper function to generate an attrset '{ x86_64-linux = f "x86_64-linux"; ... }'.
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;

      # Nixpkgs instantiated for supported system types.
      nixpkgsFor = forAllSystems (system: import nixpkgs { inherit system; });

    in
    {

      # Provide some binary packages for selected system types.
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgsFor.${system};
        in
        {
          app = pkgs.buildNpmPackage {
            pname = "audimance-app";
            inherit version;

            src = ./.;

            nativeBuildInputs = [
              pkgs.nodejs_26
            ];

            vendorHash = "sha256-Up6pjR9C2Z5wX6yLnEytdqjGCqKMCbLUvEzTZIMN8sU=";
            npmDepsHash = "sha256-6dDY4qR40LYpcVA8lkhSc3McupBpkYAOK8eDS35/Fvo=";
            npmDepsFetcherVersion = 2;
          };

          default = pkgs.buildGoModule {
            pname = "audimance";
            inherit version;
            src = ./.;

            buildInputs = [ self.packages.${system}.app ];
            nativeBuildInputs = [
              pkgs.goreleaser
            ];

            preBuild = ''
              mkdir app
              cp ${self.packages.${system}.app}/lib/node_modules/audimance-app/app/* app/
            '';

            vendorHash = "sha256-c9foWekoQRXSwFpmk+gQbmqN5aqzhG9ABq9DaCoHagI=";
          };
        }
      );

      overlays.default = (
        final: prev: {
          audimance = self.packages.${prev.system}.default;
        }
      );
    };
}
