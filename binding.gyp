{
    'targets': [{
        'target_name': 'sourceId2Coordinates',
        'cflags!': [ '-fno-exceptions' ],
        'cflags_cc!': [ '-fno-exceptions' ],
        'xcode_settings': { 'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
          'CLANG_CXX_LIBRARY': 'libc++',
          'MACOSX_DEPLOYMENT_TARGET': '10.7',
        },
        'msvs_settings': {
          'VCCLCompilerTool': { 'ExceptionHandling': 1 },
        },
        'include_dirs': [
          '<!(node -p "require(\'node-addon-api\').include_dir")',
        ],

        'conditions': [
            ["OS=='win'", {
                'defines': ['IS_WINDOWS']
            }]
        ],

        'sources': [
            'node_addons/sourceId2Coordinates/src/index.cc',
            'node_addons/sourceId2Coordinates/src/sourceId2Coordinates.cc'
        ]
    }],
}
