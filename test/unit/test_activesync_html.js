/**
 * Test our processing of HTML messages and messages with attachments from
 * ActiveSync.
 **/

load('resources/loggest_test_framework.js');
const $wbxml = require('wbxml');
const $ascp = require('activesync/codepages');
load('resources/messageGenerator.js');
load('../activesync_server.js');

var TD = $tc.defineTestsFor(
  { id: 'test_activesync_html' }, null, [$th_imap.TESTHELPER], ['app']);

TD.commonCase('folder sync', function(T) {
  T.group('setup');
  var testUniverse = T.actor('testUniverse', 'U'),
      testServer = T.actor('testActiveSyncServer', 'S',
                           { universe: testUniverse }),
      testAccount = T.actor('testActiveSyncAccount', 'A',
                            { universe: testUniverse, server: testServer }),
      eCheck = T.lazyLogger('messageCheck');

  var fullSyncFolder = testAccount.do_createTestFolder(
    'test_html_messages',
    { count: 0 });

  var bstrTrivialHtml =
        '<html><head></head><body>I am HTML! Woo!</body></html>',
      bstrSanitizedTrivialHtml =
        'I am HTML! Woo!',
      bpartTrivialHtml = new SyntheticPartLeaf(
        bstrTrivialHtml, {contentType: 'text/html'}),

      bstrLimitedHtml =
        '<div>I <form>am <span>HTML!</span></form></div>',
      bstrSanitizedLimitedHtml =
        '<div>I am <span>HTML!</span></div>',
      bpartLimitedHtml =
        new SyntheticPartLeaf(
          bstrLimitedHtml, { contentType: 'text/html' }),

      bstrLongTextHtml =
        '<p>This is a very long message that wants to be snippeted to a ' +
        'reasonable length that is reasonable and not unreasonable.  It is ' +
        'neither too long nor too short.  Not too octogonal nor hexagonal. ' +
        'It is just right.</p>',
      bpartLongTextHtml =
        new SyntheticPartLeaf(
          bstrLongTextHtml, { contentType: 'text/html' }),

      bstrStyleHtml =
        '<style type="text/css">' +
        'p { color: red; background-color: blue;' +
        ' background-image: url("http://example.com/danger.png"); }\n' +
        '@font-face { font-family: "Bob";' +
        ' src: url("http://example.com/bob.woff"); }\n' +
        'blockquote { color: pink; }' +
        '</style>I am the <span>a<span>ctua</span>l</span> content.',
      bstrSanitizedStyleHtml =
        '<style type="text/css">' +
        'p { color: red; background-color: blue; }\n' +
        'blockquote { color: pink; }' +
        '</style>I am the <span>a<span>ctua</span>l</span> content.',
      snipStyleHtml = 'I am the actual content.',
      bpartStyleHtml =
        new SyntheticPartLeaf(
          bstrStyleHtml, { contentType: 'text/html' });


  var testMessages = [
    {
      name: 'text/html trivial (sanitized to just text)',
      bodyPart: bpartTrivialHtml,
      checkBody: bstrSanitizedTrivialHtml,
    },
    {
      name: 'text/html limited (sanitization leaves some behind)',
      bodyPart: bpartLimitedHtml,
      checkBody: bstrSanitizedLimitedHtml,
    },
    {
      name: 'text/html long string for quoting',
      bodyPart: bpartLongTextHtml,
      checkBody: bstrLongTextHtml,
      checkSnippet:
        'This is a very long message that wants to be snippeted to a ' +
        'reasonable length that is reasonable and',
    },
    {
      name: 'text/html w/style tag',
      bodyPart: bpartStyleHtml,
      checkBody: bstrSanitizedStyleHtml,
      checkSnippet: snipStyleHtml,
    },
  ];

  for (var i = 0; i < testMessages.length; i++) {
    var msgDef = testMessages[i];
    msgDef.age = { days: 1, hours: i };
    testAccount.do_addMessageToFolder(fullSyncFolder, msgDef);
  }

  var folderView = testAccount.do_openFolderView(
    'syncs', fullSyncFolder,
    { count: testMessages.length, full: testMessages.length, flags: 0,
      deleted: 0 },
    { top: true, bottom: true, grow: false }
  );
  // -- check each message in its own step
  testMessages.forEach(function checkMessage(msgDef, iMsg) {
    T.check(eCheck, msgDef.name, function() {
      eCheck.expect_namedValue('body', msgDef.checkBody);
      if (msgDef.checkSnippet)
        eCheck.expect_namedValue('snippet', msgDef.checkSnippet);
      if ('attachments' in msgDef) {
        for (var i = 0; i < msgDef.attachments.length; i++) {
          eCheck.expect_namedValue('attachment', msgDef.attachments._filename);
        }
      }

      var header = folderView.slice.items[iMsg];
      header.getBody(function(body) {
        var bodyValue;
        if (!body.bodyReps.length)
          bodyValue = '';
        else if (body.bodyReps[0] === 'plain')
          bodyValue = body.bodyReps[1][1] || '';
        else if (body.bodyReps[0] === 'html')
          bodyValue = body.bodyReps[1];
        eCheck.namedValue('body', bodyValue);
        if (msgDef.checkSnippet)
          eCheck.namedValue('snippet', header.snippet);
        if (body.attachments && body.attachments.length) {
          for (var i = 0; i < body.attachments.length; i++) {
            eCheck.expect_namedValue('attachment',
                                     body.attachments[i].filename);
          }
        }
        body.die();
      });
    });
  });

  T.group('cleanup');
  testAccount.do_closeFolderView(folderView);
});

function run_test() {
  runMyTests(5);
}
