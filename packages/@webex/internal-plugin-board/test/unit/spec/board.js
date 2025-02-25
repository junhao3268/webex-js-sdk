/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import querystring from 'querystring';

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Board, {config as boardConfig} from '@webex/internal-plugin-board';

describe('plugin-board', () => {
  let webex;
  const encryptedData = 'encryptedData';
  const decryptedText = 'decryptedText';
  const fakeURL = `${
    process.env.ENCRYPTION_SERVICE_URL || 'https://encryption-a.wbx2.com'
  }/encryption/api/v1/keys/8a7d3d78-ce75-48aa-a943-2e8acf63fbc9`;
  const file = 'dataURL://base64;';
  const boardServiceUrl = 'https://awesome.service.url';
  const boardId = 'boardId';

  const mockKey = {
    uri: `${
      process.env.ENCRYPTION_SERVICE_URL || 'https://encryption-a.wbx2.com'
    }/encryption/api/v1/keys/7ad503ec-854b-4fce-a7f0-182e1997bdb6`,
  };

  const image = {
    height: 900,
    width: 1600,
    size: 15000,
  };

  const conversation = {
    id: '7c7e69a0-a086-11e6-8670-d7b4b51d7641',
    defaultActivityEncryptionKeyUrl: fakeURL,
    kmsResourceObjectUrl: `${
      process.env.ENCRYPTION_SERVICE_URL || 'https://encryption-a.wbx2.com'
    }/encryption/api/v1/resources/8693f702-2012-40c6-9ec4-f1392f0a620a`,
    aclUrl: 'https://acl-a.wbx2.com/acl/api/v1/acls/7ca94a30-a086-11e6-b599-d90deb9846ed',
  };

  const channel = {
    channelUrl: `${boardServiceUrl}/channels/${boardId}`,
    channelId: boardId,
    aclUrlLink: conversation.aclUrl,
    aclUrl: 'https://acl-a.wbx2.com/acl/api/v1/acls/e2947ee0-972b-11e7-a041-d564bb1fbb45',
    defaultEncryptionKeyUrl: mockKey.uri,
    kmsResourceUrl: `${
      process.env.ENCRYPTION_SERVICE_URL || 'https://encryption-a.wbx2.com'
    }/encryption/api/v1/resources/18f7c618-2eff-461e-ac46-819a0fd2b476`,
    kmsMessage: {
      method: 'create',
      uri: '/resources',
      userIds: [conversation.kmsResourceObjectUrl],
      keyUris: [],
    },
  };

  const channelRes = {
    channelUrl: `${boardServiceUrl}/channels/${boardId}`,
    channelId: boardId,
    aclUrlLink: conversation.aclUrl,
    aclUrl: 'https://acl-a.wbx2.com/acl/api/v1/acls/e2947ee0-972b-11e7-a041-d564bb1fbb45',
    defaultEncryptionKeyUrl: mockKey.uri,
    creatorId: 'c321e329-28d6-4d52-a9d1-374010411530',
    kmsResourceUrl: `${
      process.env.ENCRYPTION_SERVICE_URL || 'https://encryption-a.wbx2.com'
    }/encryption/api/v1/resources/18f7c618-2eff-461e-ac46-819a0fd2b476`,
    kmsMessage: {
      status: 201,
      resource: {
        uri: `${
          process.env.ENCRYPTION_SERVICE_URL || 'https://encryption-a.wbx2.com'
        }/encryption/api/v1/resources/2853285c-c46b-4b35-9542-9a81d4e3c87f`,
        keyUris: [
          `${
            process.env.ENCRYPTION_SERVICE_URL || 'https://encryption-a.wbx2.com'
          }/encryption/api/v1/keys/5042787d-510b-46f3-b83c-ea73032de851`,
        ],
        authorizationUris: [
          `${
            process.env.ENCRYPTION_SERVICE_URL || 'https://encryption-a.wbx2.com'
          }/encryption/api/v1/authorizations/aHR0cHM6Ly9lbmNyeXB0aW9uLWEud2J4Mi5jb20vZW5jcnlwdGlvbi9hcGkvdjEvcmVzb3VyY2VzLzI3OWIyMjgyLWZmYTItNGM3ZC04NGRmLTRkNDVlZmUzYTMzNQBodHRwczovL2VuY3J5cHRpb24tYS53YngyLmNvbS9lbmNyeXB0aW9uL2FwaS92MS9yZXNvdXJjZXMvMjg1MzI4NWMtYzQ2Yi00YjM1LTk1NDItOWE4MWQ0ZTNjODdm`,
          `${
            process.env.ENCRYPTION_SERVICE_URL || 'https://encryption-a.wbx2.com'
          }/encryption/api/v1/authorizations/YzMyMWUzMjktMjhkNi00ZDUyLWE5ZDEtMzc0MDEwNDExNTMwAGh0dHBzOi8vZW5jcnlwdGlvbi1hLndieDIuY29tL2VuY3J5cHRpb24vYXBpL3YxL3Jlc291cmNlcy8yODUzMjg1Yy1jNDZiLTRiMzUtOTU0Mi05YTgxZDRlM2M4N2Y`,
        ],
      },
    },
  };

  const data1 = {
    contentUrl: `${channel.channelUrl}/contents/data1`,
    contentId: 'data1',
    type: 'test',
    data: 'data1',
  };

  const data2 = {
    type: 'test',
    data: 'data2',
  };

  before(() => {
    webex = new MockWebex({
      children: {
        board: Board,
      },
      request: sinon.stub().returns(
        Promise.resolve({
          headers: {},
          body: '',
        })
      ),
      upload: sinon.stub().returns(Promise.resolve({body: {downloadUrl: fakeURL}})),
    });

    Object.assign(webex.internal, {
      device: {
        deviceType: 'FAKE_DEVICE',
        getServiceUrl: () => boardServiceUrl,
      },
      encryption: {
        decryptText: sinon.stub().returns(Promise.resolve(decryptedText)),
        encryptText: sinon.stub().returns(Promise.resolve(encryptedData)),
        encryptBinary: sinon.stub().returns(
          Promise.resolve({
            scr: {},
            cdata: encryptedData,
          })
        ),
        download: sinon.stub().returns(
          Promise.resolve({
            toArrayBuffer: sinon.stub(),
          })
        ),
        decryptScr: sinon.stub().returns(Promise.resolve('decryptedFoo')),
        encryptScr: sinon.stub().returns(Promise.resolve('encryptedFoo')),
      },
    });

    webex.config.board = boardConfig.board;
  });

  describe('#addContent()', () => {
    beforeEach(() => {
      webex.request.resetHistory();
    });

    it('requests POST all contents to contents', () =>
      webex.internal.board.addContent(channel, [data1, data2]).then(() => {
        assert.calledWith(
          webex.request,
          sinon.match({
            method: 'POST',
            uri: `${boardServiceUrl}/channels/${boardId}/contents`,
            body: [
              {
                device: 'FAKE_DEVICE',
                type: 'STRING',
                encryptionKeyUrl: mockKey.uri,
                payload: 'encryptedData',
              },
              {
                device: 'FAKE_DEVICE',
                type: 'STRING',
                encryptionKeyUrl: mockKey.uri,
                payload: 'encryptedData',
              },
            ],
          })
        );
      }));

    it('sends large data using multiple requests', () => {
      const largeData = [];

      for (let i = 0; i < 400; i += 1) {
        largeData.push({data: i});
      }

      return webex.internal.board.addContent(channel, largeData).then(() => {
        assert.equal(webex.request.callCount, 3);
      });
    });
  });

  describe('#setSnapshotImage()', () => {
    beforeEach(() => {
      webex.request.resetHistory();
      sinon.stub(webex.internal.board, '_uploadImageToWebexFiles').returns(
        Promise.resolve({
          downloadUrl: fakeURL,
        })
      );
      webex.internal.encryption.encryptScr.resetHistory();
    });

    afterEach(() => {
      webex.internal.board._uploadImageToWebexFiles.restore();
      webex.internal.encryption.encryptScr.resetHistory();
    });

    it('requests PATCH to board service', () =>
      webex.internal.board.setSnapshotImage(channel, image).then(() => {
        assert.calledWith(
          webex.request,
          sinon.match({
            method: 'PATCH',
            uri: channel.channelUrl,
            body: {
              image: {
                url: fakeURL,
                height: image.height,
                width: image.width,
                mimeType: 'image/png',
                scr: 'encryptedFoo',
                encryptionKeyUrl: channel.defaultEncryptionKeyUrl,
                fileSize: image.size,
              },
            },
          })
        );
      }));
  });

  describe('#createChannel()', () => {
    const channelRequestBody = {
      aclUrlLink: channel.aclUrlLink,
      kmsMessage: channel.kmsMessage,
    };

    before(() => {
      webex.request.resetHistory();
      webex.request.returns(Promise.resolve({statusCode: 200, body: channelRes}));

      
    });

    after(() => {
      // reset request to its original behavior
      webex.request.returns(
        Promise.resolve({
          headers: {},
          body: '',
        })
      );
    });

    it('supports creating ambiguous channels for PMR support', () => {
      return webex.internal.board.createChannel()
        .then(() => {
          assert.calledWith(
            webex.request,
            sinon.match({
              method: 'POST',
              api: 'board',
              resource: '/channels',
              body: {
                kmsMessage: {
                  method: 'create',
                  uri: '/resources',
                  userIds: [],
                  keyUris: [],
                },
              }
            })
          )
        })
    });

    it('requests POST to channels service', () => {
      return webex.internal.board.createChannel(conversation)
        .then(() => {
          assert.calledWith(
            webex.request,
            sinon.match({
              method: 'POST',
              api: 'board',
              resource: '/channels',
              body: channelRequestBody,
            }),
          );
        });
    });
  });

  describe('#deleteChannel()', () => {
    it('requests PUT to ACL service to remove the link between conversation and board', () => {
      webex.request.resetHistory();

      return webex.internal.board.deleteChannel(conversation, channel).then(() => {
        assert.calledWith(
          webex.request,
          sinon.match({
            method: 'PUT',
            uri: `${channel.aclUrl}/links`,
            body: {
              aclLinkType: 'INCOMING',
              linkedAcl: conversation.aclUrl,
              kmsMessage: {
                method: 'delete',
                uri: `${channel.kmsResourceUrl}/authorizations?${querystring.stringify({
                  authId: conversation.kmsResourceObjectUrl,
                })}`,
              },
              aclLinkOperation: 'DELETE',
            },
          })
        );
      });
    });

    it('requests locks channel before delete when preventDeleteActiveChannel is enabled', () => {
      webex.request.resetHistory();

      return webex.internal.board
        .deleteChannel(conversation, channel, {preventDeleteActiveChannel: true})
        .then(() => {
          assert.calledWith(
            webex.request,
            sinon.match({
              method: 'POST',
              uri: `${channel.channelUrl}/lock`,
              qs: {
                intent: 'delete',
              },
            })
          );

          assert.calledWith(
            webex.request,
            sinon.match({
              method: 'PUT',
              uri: `${channel.aclUrl}/links`,
              body: {
                aclLinkType: 'INCOMING',
                linkedAcl: conversation.aclUrl,
                kmsMessage: {
                  method: 'delete',
                  uri: `${channel.kmsResourceUrl}/authorizations?${querystring.stringify({
                    authId: conversation.kmsResourceObjectUrl,
                  })}`,
                },
                aclLinkOperation: 'DELETE',
              },
            })
          );
        });
    });
  });

  describe('#lockChannelForDeletion()', () => {
    it('requests POST with delete lock intent', () => {
      webex.request.resetHistory();

      return webex.internal.board.lockChannelForDeletion(channel).then(() => {
        assert.calledWith(
          webex.request,
          sinon.match({
            method: 'POST',
            uri: `${channel.channelUrl}/lock`,
            qs: {
              intent: 'delete',
            },
          })
        );
      });
    });
  });

  describe('#keepActive()', () => {
    it('requests POST to keep channel status active', () => {
      webex.request.resetHistory();

      return webex.internal.board.keepActive(channel).then(() => {
        assert.calledWith(
          webex.request,
          sinon.match({
            method: 'POST',
            uri: `${channel.channelUrl}/keepAlive`,
          })
        );
      });
    });
  });

  describe('#deleteAllContent()', () => {
    before(() => {
      webex.request.resetHistory();

      return webex.internal.board.deleteAllContent(channel);
    });

    it('requests DELETE contents', () => {
      assert.calledWith(
        webex.request,
        sinon.match({
          method: 'DELETE',
          uri: `${boardServiceUrl}/channels/${boardId}/contents`,
        })
      );
    });
  });

  describe('#deletePartialContent()', () => {
    it('requests POST contents with body contains the content to keep', () => {
      webex.request.resetHistory();

      return webex.internal.board.deletePartialContent(channel, [data1]).then(() => {
        assert.calledWith(
          webex.request,
          sinon.match({
            method: 'POST',
            uri: `${boardServiceUrl}/channels/${boardId}/contents`,
            qs: {clearBoard: true},
            body: [
              {
                contentId: data1.contentId,
              },
            ],
          })
        );
      });
    });
  });

  describe('#_uploadImage()', () => {
    before(() => {
      sinon.stub(webex.internal.board, '_uploadImageToWebexFiles').returns(
        Promise.resolve({
          downloadUrl: fakeURL,
        })
      );

      return webex.internal.board._uploadImage(conversation, file);
    });

    after(() => {
      webex.internal.board._uploadImageToWebexFiles.restore();
    });

    it('encrypts binary file', () => {
      assert.calledWith(webex.internal.encryption.encryptBinary, file);
    });

    it('uploads to webex files', () => {
      assert.calledWith(webex.internal.board._uploadImageToWebexFiles, conversation, encryptedData);
    });
  });

  describe('#_uploadImageToWebexFiles()', () => {
    before(() => {
      sinon.stub(webex.internal.board, '_getSpaceUrl').returns(Promise.resolve(fakeURL));

      return webex.internal.board._uploadImage(conversation, file);
    });

    after(() => webex.internal.board._getSpaceUrl.restore());

    afterEach(() => {
      webex.upload.resetHistory();
      webex.internal.board._getSpaceUrl.resetHistory();
    });

    it('uses length for upload filesize', () => {
      const blob = {
        length: 4444,
        size: 3333,
        byteLength: 2222,
      };

      return webex.internal.board._uploadImageToWebexFiles(conversation, blob).then(() => {
        assert.calledWith(
          webex.upload,
          sinon.match({
            phases: {
              initialize: {
                fileSize: 4444,
              },
              finalize: {
                body: {
                  fileSize: 4444,
                },
              },
            },
          })
        );
      });
    });

    it('uses size for upload filesize when length is not available', () => {
      const blob = {
        size: 3333,
        byteLength: 2222,
      };

      return webex.internal.board._uploadImageToWebexFiles(conversation, blob).then(() => {
        assert.calledWith(
          webex.upload,
          sinon.match({
            phases: {
              initialize: {
                fileSize: 3333,
              },
              finalize: {
                body: {
                  fileSize: 3333,
                },
              },
            },
          })
        );
      });
    });

    it('uses byteLenght for upload filesize when length and size are not available', () => {
      const blob = {
        byteLength: 2222,
      };

      return webex.internal.board._uploadImageToWebexFiles(conversation, blob).then(() => {
        assert.calledWith(
          webex.upload,
          sinon.match({
            phases: {
              initialize: {
                fileSize: 2222,
              },
              finalize: {
                body: {
                  fileSize: 2222,
                },
              },
            },
          })
        );
      });
    });
  });

  describe('#children', () => {
    it('has a child of realtime', () => {
      assert.isDefined(webex.internal.board.realtime);
    });
  });

  describe('#getChannel()', () => {
    before(() => {
      webex.request.resetHistory();

      return webex.internal.board.getChannel(channel);
    });

    it('requests GET to channels service', () => {
      assert.calledWith(
        webex.request,
        sinon.match({
          method: 'GET',
          uri: `${boardServiceUrl}/channels/${boardId}`,
        })
      );
    });

    it('requires conversationId', () =>
      assert.isRejected(webex.internal.board.getChannels(), '`conversation` is required'));
  });

  describe('#getContents()', () => {
    beforeEach(() => {
      sinon.stub(webex.internal.board, 'decryptContents').returns(['foo']);
      webex.request.resetHistory();
    });

    afterEach(() => {
      webex.internal.board.decryptContents.restore();
    });

    it('requests GET contents with default page size', () =>
      webex.internal.board.getContents(channel).then(() =>
        assert.calledWith(webex.request, {
          uri: `${boardServiceUrl}/channels/${boardId}/contents`,
          qs: {
            contentsLimit: boardConfig.board.numberContentsPerPageForGet,
          },
        })
      ));

    it('requests GET contents with client defined page size', () =>
      webex.internal.board.getContents(channel, {contentsLimit: 25}).then(() =>
        assert.calledWith(webex.request, {
          uri: `${boardServiceUrl}/channels/${boardId}/contents`,
          qs: {
            contentsLimit: 25,
          },
        })
      ));
  });

  describe('#register()', () => {
    before(() => {
      webex.request.resetHistory();

      return webex.internal.board.register({data: 'data'});
    });

    it('requests POST data to registration service', () => {
      assert.calledWith(
        webex.request,
        sinon.match({
          method: 'POST',
          api: 'board',
          resource: '/registrations',
        })
      );
    });
  });

  describe('#registerToShareMercury()', () => {
    beforeEach(() => {
      webex.request.resetHistory();
      webex.internal.mercury.localClusterServiceUrls = {
        mercuryApiServiceClusterUrl: 'https://mercury-api-a5.wbx2.com/v1',
        mercuryConnectionServiceClusterUrl: 'https://mercury-connection-a5.wbx2.com/v1',
      };
      webex.internal.feature.getFeature.returns(Promise.resolve(true));
    });

    it('requests POST data to registration service', () =>
      webex.internal.board.registerToShareMercury(channel).then(() => {
        assert.calledWith(
          webex.request,
          sinon.match({
            method: 'POST',
            uri: `${channel.channelUrl}/register`,
            body: {
              mercuryConnectionServiceClusterUrl:
                webex.internal.mercury.localClusterServiceUrls.mercuryConnectionServiceClusterUrl,
              webSocketUrl: webex.internal.device.webSocketUrl,
              action: 'ADD',
            },
          })
        );
      }));

    it('rejects when localClusterServiceUrls is null', () => {
      webex.internal.mercury.localClusterServiceUrls = null;

      return assert.isRejected(webex.internal.board.registerToShareMercury(channel));
    });

    it('rejects when web-shared-mercury is not enabled', () => {
      webex.internal.feature.getFeature.returns(Promise.resolve(false));

      return assert.isRejected(webex.internal.board.registerToShareMercury(channel));
    });
  });
});
