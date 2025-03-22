{
    'targets': [{
        'target_name': 'sourceId2Coordinates',
        'msvs_settings': {
            'VCCLCompilerTool': { 'ExceptionHandling': 1 }
        },
        'include_dirs': [
            '<!(node -p "require(\'node-addon-api\').include_dir")',
        ],
        'conditions': [
            ["OS=='win'", {
                'sources': [
                    'node_addons/sourceId2Coordinates/src/index.cc',
                    'node_addons/sourceId2Coordinates/src/sourceId2Coordinates.cc'
                ],
                'cflags_cc': [
                    '/EHsc'
                ]
            }]
        ]
    }]
}