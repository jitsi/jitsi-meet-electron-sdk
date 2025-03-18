{
  'targets': [
    {
      'target_name': 'sourceId2Coordinates',
      'sources': [
        'src/index.cc',
        'src/sourceId2Coordinates.cc'
      ],
      'include_dirs': [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      'defines': [
        'NAPI_CPP_EXCEPTIONS'
      ],
      'cflags_cc': [
        '/EHsc'
      ]
    }
  ]
}