{
    'targets': [{
        'target_name': 'sourceId2Coordinates',
        'include_dirs': [
            "<!(node -e \"require('nan')\")"
        ],

        'cflags': [
            '-Wall',
            '-Wparentheses',
            '-Winline',
            '-Wbad-function-cast',
            '-Wdisabled-optimization'
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

    'variables': {
        'build_v8_with_gn': 0
    },
}
