/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-board';

import {assert} from '@webex/test-helper-chai';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';
import fh from '@webex/test-helper-file';
import {find, map} from 'lodash';
import uuid from 'uuid';

function generateTonsOfContents(numOfContents) {
  return new Promise((resolve) => {
    const contents = [];

    for (let i = 0; i < numOfContents; i += 1) {
      contents.push({
        type: 'curve',
        payload: JSON.stringify({id: i, type: 'curve'}),
      });
    }
    resolve(contents);
  });
}

describe('plugin-board', () => {
  describe('service', () => {
    let board, conversation, fixture, participants;

    before('create users', () =>
      testUsers.create({count: 3}).then((users) => {
        participants = users;

        return Promise.all(
          map(participants, (participant) => {
            participant.webex = new WebexCore({
              credentials: {
                authorization: participant.token,
              },
            });

            return participant.webex.internal.device
              .register()
              .then(() =>
                participant.webex.internal.feature.setFeature('developer', 'files-acl-write', true)
              );
          })
        );
      })
    );

    before('create conversation', () =>
      participants[0].webex.internal.conversation
        .create({
          displayName: 'Test Board Conversation',
          participants,
        })
        .then((c) => {
          conversation = c;

          return conversation;
        })
    );

    before('create channel (board)', () =>
      participants[0].webex.internal.board.createChannel(conversation).then((channel) => {
        board = channel;

        return channel;
      })
    );

    before('load fixture image', () =>
      fh.fetch('sample-image-small-one.png').then((fetchedFixture) => {
        fixture = fetchedFixture;

        return fetchedFixture;
      })
    );

    after('disconnect mercury', () =>
      Promise.all(
        map(participants, (participant) => participant.webex.internal.mercury.disconnect())
      )
    );

    describe('#getChannel', () => {
      it('gets the channel metadata', () =>
        participants[0].webex.internal.board.getChannel(board).then((channel) => {
          assert.property(channel, 'kmsResourceUrl');
          assert.property(channel, 'aclUrl');

          assert.equal(channel.channelUrl, board.channelUrl);
          assert.equal(channel.aclUrlLink, conversation.aclUrl);
          assert.notEqual(channel.kmsResourceUrl, conversation.kmsResourceObjectUrl);
          assert.notEqual(channel.aclUrl, conversation.aclUrl);
          assert.notEqual(
            channel.defaultEncryptionKeyUrl,
            conversation.defaultActivityEncryptionKeyUrl
          );
        }));
    });

    describe('#_uploadImage()', () => {
      after(() => participants[0].webex.internal.board.deleteAllContent(board));

      it('uploads image to webex files', () =>
        participants[0].webex.internal.board
          ._uploadImage(board, fixture)
          .then((scr) => {
            participants[0].webex.logger.debug('@@@@', scr)
            return participants[1].webex.internal.encryption.download(scr.loc, scr)})
          .then((downloadedFile) =>
            fh
              .isMatchingFile(downloadedFile, fixture)
              .then((result) => assert.deepEqual(result, true))
          ));
    });

    describe('#setSnapshotImage()', () => {
      after(() => participants[0].webex.internal.board.deleteAllContent(board));

      it('uploads image to webex files and adds to channel', () => {
        let imageRes;

        return participants[0].webex.internal.board
          .setSnapshotImage(board, fixture)
          .then((res) => {
            imageRes = res.image;
            assert.isDefined(res.image, 'image field is included');
            assert.equal(res.image.encryptionKeyUrl, board.defaultEncryptionKeyUrl);
            assert.isAbove(res.image.scr.length, 0, 'scr string exists');

            return participants[1].webex.internal.board.getChannel(board);
          })
          .then((res) => {
            assert.deepEqual(imageRes, res.image);

            // ensure others can download the image
            return participants[2].webex.internal.encryption.decryptScr(
              board.defaultEncryptionKeyUrl,
              res.image.scr
            );
          })
          .then((decryptedScr) => participants[2].webex.internal.encryption.download(decryptedScr.loc, decryptedScr))
          .then((file) =>
            fh.isMatchingFile(file, fixture).then((result) => assert.deepEqual(result, true))
          );
      });
    });

    describe('#ping()', () => {
      it('pings board service', () => participants[0].webex.internal.board.ping());
    });

    describe('#addImage()', () => {
      let testContent, testScr;

      after(() => participants[0].webex.internal.board.deleteAllContent(board));

      it('uploads image to webex files', () =>
        participants[0].webex.internal.board
          .addImage(board, fixture, {displayName: fixture.name})
          .then((fileContent) => {
            testContent = fileContent[0].items[0];
            assert.equal(testContent.type, 'FILE', 'content type should be image');
            assert.property(testContent, 'contentUrl', 'content should contain contentId property');
            assert.property(
              testContent,
              'channelUrl',
              'content should contain contentUrl property'
            );
            assert.property(testContent, 'metadata', 'content should contain metadata property');
            assert.property(testContent, 'file', 'content should contain file property');
            assert.property(testContent.file, 'scr', 'content file should contain scr property');
          }));

      it('adds to presistence', () =>
        participants[0].webex.internal.board.getContents(board).then((allContents) => {
          const imageContent = find(allContents.items, {contentId: testContent.contentId});

          assert.isDefined(imageContent);
          assert.property(imageContent, 'file');
          assert.property(imageContent.file, 'scr');
          assert.equal(imageContent.metadata.displayName, 'sample-image-small-one.png');
          testScr = imageContent.file.scr;

          return imageContent.file.scr;
        }));

      it('matches file file downloaded', () =>
        participants[0].webex.internal.encryption
          .download(testScr.loc, testScr)
          .then((downloadedFile) =>
            fh
              .isMatchingFile(downloadedFile, fixture)
              .then((result) => assert.deepEqual(result, true))
          ));

      it('allows others to download image', () =>
        participants[2].webex.internal.encryption
          .download(testScr.loc, testScr)
          .then((downloadedFile) =>
            fh
              .isMatchingFile(downloadedFile, fixture)
              .then((result) => assert.deepEqual(result, true))
          ));

      describe('when image content has no metadata', () => {
        before(() => participants[0].webex.internal.board.deleteAllContent(board));

        it('decrypts no meta', () => {
          let testContent, testScr;

          return participants[0].webex.internal.board
            .addImage(board, fixture)
            .then((fileContent) => {
              testContent = fileContent[0].items[0];
              assert.equal(testContent.type, 'FILE', 'content type should be image');
              assert.property(
                testContent,
                'contentUrl',
                'content should contain contentId property'
              );
              assert.property(
                testContent,
                'channelUrl',
                'content should contain contentUrl property'
              );
              assert.property(testContent, 'file', 'content should contain file property');
              assert.property(testContent.file, 'scr', 'content file should contain scr property');
              assert.deepEqual(testContent.metadata, {});

              return participants[0].webex.internal.board.getContents(board);
            })
            .then((allContents) => {
              const imageContent = find(allContents.items, {contentId: testContent.contentId});

              assert.isDefined(imageContent);
              assert.property(imageContent, 'file');
              assert.property(imageContent.file, 'scr');
              testScr = imageContent.file.scr;

              return imageContent.file.scr;
            })
            .then(() =>
              participants[0].webex.internal.encryption
                .download(testScr.loc, testScr)
                .then((downloadedFile) => fh.isMatchingFile(downloadedFile, fixture))
                .then((res) => assert.isTrue(res))
            );
        });
      });
    });

    describe('#getChannels()', () => {
      it('retrieves a newly created board for a specified conversation within a single page', () =>
        participants[0].webex.internal.board.getChannels(conversation).then((getChannelsResp) => {
          const channelFound = find(getChannelsResp.items, {channelId: board.channelId});

          assert.isDefined(channelFound);
          assert.notProperty(getChannelsResp.links, 'next');
        }));

      it('retrieves annotated board', () => {
        let annotatedBoard;

        return participants[0].webex.internal.board
          .createChannel(conversation, {type: 'annotated'})
          .then((res) => {
            annotatedBoard = res;

            return participants[0].webex.internal.board.getChannels(conversation, {
              type: 'annotated',
            });
          })
          .then((getChannelsResp) => {
            const channelFound = find(getChannelsResp.items, {channelId: annotatedBoard.channelId});

            assert.isUndefined(find(getChannelsResp.items, {channelId: board.channelId}));
            assert.isDefined(channelFound);
            assert.notProperty(getChannelsResp.links, 'next');
          });
      });

      it('retrieves all boards for a specified conversation across multiple pages', () => {
        const numChannelsToAdd = 12;
        const pageLimit = 5;
        const channelsCreated = [];
        let channelsReceived = [];
        let convo;

        return (
          participants[0].webex.internal.conversation
            .create({
              displayName: `Test Get Channels Conversation ${uuid.v4()}`,
              participants,
            })
            .then((c) => {
              convo = c;
              const promises = [];

              for (let i = 0; i < numChannelsToAdd; i += 1) {
                promises.push(
                  participants[0].webex.internal.board.createChannel(convo).then((channel) => {
                    Reflect.deleteProperty(channel, 'kmsMessage');
                    channelsCreated.push(channel);
                  })
                );
              }

              return Promise.all(promises);
            })
            // get boards, page 1
            .then(() =>
              participants[0].webex.internal.board.getChannels(convo, {
                channelsLimit: pageLimit,
              })
            )
            // get boards, page 2
            .then((channelPage) => {
              assert.lengthOf(channelPage.items, pageLimit);
              assert.isTrue(channelPage.hasNext());
              channelsReceived = channelsReceived.concat(channelPage.items);

              return channelPage.next();
            })
            // get boards, page 3
            .then((channelPage) => {
              assert.lengthOf(channelPage.items, pageLimit);
              assert.isTrue(channelPage.hasNext());
              channelsReceived = channelsReceived.concat(channelPage.items);

              return channelPage.next();
            })
            .then((channelPage) => {
              assert.lengthOf(channelPage, 2);
              assert.isFalse(channelPage.hasNext());
              channelsReceived = channelsReceived.concat(channelPage.items);

              if (channelsCreated.length === channelsReceived.length) {
                channelsReceived.forEach((received) => {
                  const created = channelsCreated.find((channel) => channel.channelId === received.channelId);

                  assert.deepEqual(received, created);
                });
              }
            })
        );
      });
    });

    describe('#getContents()', () => {
      afterEach(() => participants[0].webex.internal.board.deleteAllContent(board));

      it('adds and gets contents from the specified board', () => {
        const contents = [{type: 'curve'}];
        const data = [
          {
            type: contents[0].type,
            payload: JSON.stringify(contents[0]),
          },
        ];

        return participants[0].webex.internal.board
          .deleteAllContent(board)
          .then(() => participants[0].webex.internal.board.addContent(board, data))
          .then(() => participants[0].webex.internal.board.getContents(board))
          .then((contentPage) => {
            assert.equal(contentPage.length, data.length);
            assert.equal(contentPage.items[0].payload, data[0].payload);
            assert.equal(contentPage.items[0].type, data[0].type);
          })
          .then(() => participants[0].webex.internal.board.deleteAllContent(board));
      });

      it('allows other people to read contents', () => {
        const contents = [{type: 'curve', points: [1, 2, 3, 4]}];
        const data = [
          {
            type: contents[0].type,
            payload: JSON.stringify(contents[0]),
          },
        ];

        return participants[0].webex.internal.board
          .addContent(board, data)
          .then(() => participants[1].webex.internal.board.getContents(board))
          .then((contentPage) => {
            assert.equal(contentPage.length, data.length);
            assert.equal(contentPage.items[0].payload, data[0].payload);

            return participants[2].webex.internal.board.getContents(board);
          })
          .then((contentPage) => {
            assert.equal(contentPage.length, data.length);
            assert.equal(contentPage.items[0].payload, data[0].payload);
          });
      });

      it('allows other people to write contents', () => {
        const contents = [{type: 'curve', points: [1, 2, 3, 4]}];
        const data = [
          {
            type: contents[0].type,
            payload: JSON.stringify(contents[0]),
          },
        ];

        return participants[2].webex.internal.board
          .addContent(board, data)
          .then(() => participants[1].webex.internal.board.getContents(board))
          .then((contentPage) => {
            assert.equal(contentPage.length, data.length);
            assert.equal(contentPage.items[0].payload, data[0].payload);
          });
      });

      describe('handles large data sets', () => {
        const numberOfContents = 30;
        let tonsOfContents;

        before('generate contents', () =>
          generateTonsOfContents(numberOfContents).then((res) => {
            tonsOfContents = res;
          })
        );

        beforeEach('create contents', () =>
          participants[0].webex.internal.board.addContent(board, tonsOfContents)
        );

        it('using the default page limit', () =>
          participants[0].webex.internal.board.getContents(board).then((res) => {
            assert.lengthOf(res, numberOfContents);
            assert.isFalse(res.hasNext());

            for (let i = 0; i < res.length; i += 1) {
              assert.equal(res.items[i].payload, tonsOfContents[i].payload, 'payload data matches');
            }
          }));

        it('using a client defined page limit', () =>
          participants[0].webex.internal.board
            .getContents(board, {contentsLimit: 25})
            .then((res) => {
              assert.lengthOf(res, 25);
              assert.isTrue(res.hasNext());

              return res.next();
            })
            .then((res) => {
              assert.lengthOf(res, numberOfContents - 25);
              assert.isFalse(res.hasNext());
            }));
      });
    });

    describe('#deleteAllContent()', () => {
      after(() => participants[0].webex.internal.board.deleteAllContent(board));

      it('delete all contents from the specified board', () => {
        const channel = board;
        const contents = [
          {
            id: uuid.v4(),
            type: 'file',
          },
          {
            id: uuid.v4(),
            type: 'string',
          },
        ];
        const data = [
          {
            type: contents[0].type,
            payload: JSON.stringify(contents[0]),
          },
          {
            type: contents[1].type,
            payload: JSON.stringify(contents[1]),
          },
        ];

        return participants[0].webex.internal.board
          .addContent(channel, data)
          .then(() => participants[0].webex.internal.board.deleteAllContent(channel))
          .then(() => participants[0].webex.internal.board.getContents(channel))
          .then((res) => {
            assert.lengthOf(res, 0);

            return res;
          });
      });
    });

    // THE SERVICE API FOR REMOVING PARTIAL CONTENT HAS CHANGED. SEE SPARK-412694.
    describe.skip('#deletePartialContent()', () => {
      after(() => participants[0].webex.internal.board.deleteAllContent(board));

      it('deletes some contents from the specified board', () => {
        const channel = board;
        const data = [
          {
            type: 'STRING',
            payload: JSON.stringify({id: uuid.v4()}),
          },
          {
            type: 'FILE',
            payload: JSON.stringify({id: uuid.v4()}),
          },
        ];
        const contentsToKeep = [];

        return participants[0].webex.internal.board
          .addContent(channel, data)
          .then(([firstPageRes]) => {
            contentsToKeep.push(firstPageRes.items[1]);
          })
          .then(() =>
            participants[0].webex.internal.board.deletePartialContent(channel, contentsToKeep)
          )
          .then(() => participants[0].webex.internal.board.getContents(channel))
          .then((page) => {
            assert.lengthOf(page, 1);
            delete page.items[0].format;
            assert.deepEqual(page.items[0], contentsToKeep[0]);

            return page;
          });
      });
    });

    describe('when a user leaves conversation', () => {
      it('does not allow board user to create board', () => {
        let currentConvo;

        return participants[0].webex.internal.conversation
          .create({
            displayName: 'Test Board Member Leave Conversation',
            participants,
          })
          .then((c) => {
            currentConvo = c;

            return participants[1].webex.internal.conversation.leave(currentConvo);
          })
          .then(() =>
            assert.isRejected(participants[1].webex.internal.board.createChannel(currentConvo))
          );
      });

      it('does not allow board creator to access and decrypt contents', () => {
        let currentConvo;
        let currentBoard;
        const encryptedBoardContent = {};
        const data = [
          {
            type: 'curve',
            payload: JSON.stringify({type: 'curve'}),
          },
        ];

        return (
          participants[1].webex.internal.conversation
            .create({
              displayName: 'Test Board Creator Leave Conversation',
              participants,
            })
            .then((c) => {
              currentConvo = c;

              return participants[1].webex.internal.board.createChannel(currentConvo);
            })
            .then((b) => {
              currentBoard = b;

              return participants[1].webex.internal.conversation.leave(currentConvo);
            })
            .then(() =>
              participants[0].webex.internal.board.encryptContents(
                currentBoard.defaultEncryptionKeyUrl,
                data
              )
            )
            .then((encryptedData) => {
              encryptedBoardContent.items = encryptedData;

              return assert.isRejected(
                participants[1].webex.internal.board.getContents(currentBoard)
              );
            })
            // ensure keys aren't cached
            .then(() => participants[1].webex.unboundedStorage.clear())
            .then(() =>
              assert.isRejected(
                participants[1].webex.internal.board.decryptContents(encryptedBoardContent)
              )
            )
        );
      });
    });

    describe('#deleteChannel()', () => {
      it('deletes channel', () => {
        let newChannel;

        return participants[1].webex.internal.board
          .createChannel(conversation)
          .then((res) => {
            newChannel = res;

            return participants[1].webex.internal.board.deleteChannel(conversation, newChannel);
          })
          .then(() =>
            assert.isRejected(participants[1].webex.internal.board.getChannel(newChannel))
          );
      });

      describe('when preventDeleteActiveChannel is enabled', () => {
        it('does not delete when a channel is being used', () => {
          let activeChannel;

          return participants[1].webex.internal.board
            .createChannel(conversation)
            .then((res) => {
              activeChannel = res;
              const data = [
                {
                  type: 'curve',
                  payload: JSON.stringify({type: 'curve'}),
                },
              ];

              // this will mark the channel as being used
              return participants[0].webex.internal.board.addContent(activeChannel, data);
            })
            .then(() =>
              assert.isRejected(
                participants[1].webex.internal.board.deleteChannel(conversation, activeChannel, {
                  preventDeleteActiveChannel: true,
                })
              )
            )
            .then(() => participants[1].webex.internal.board.getChannel(activeChannel));
        });

        it('deletes inactive channel', () => {
          let inActiveChannel;

          return participants[1].webex.internal.board
            .createChannel(conversation)
            .then((res) => {
              inActiveChannel = res;

              return participants[1].webex.internal.board.deleteChannel(
                conversation,
                inActiveChannel,
                {preventDeleteActiveChannel: true}
              );
            })
            .then(() =>
              assert.isRejected(participants[1].webex.internal.board.getChannel(inActiveChannel))
            );
        });
      });
    });

    describe('#lockChannelForDeletion()', () => {
      it('locks a channel for deletion which rejects any incoming activities', () => {
        let newChannel;

        return participants[1].webex.internal.board
          .createChannel(conversation)
          .then((res) => {
            newChannel = res;

            return participants[1].webex.internal.board.lockChannelForDeletion(newChannel);
          })
          .then(() => {
            const data = [
              {
                type: 'curve',
                payload: JSON.stringify({type: 'curve'}),
              },
            ];

            return assert.isRejected(
              participants[0].webex.internal.board.addContent(newChannel, data)
            );
          });
      });
    });

    describe('#keepActive()', () => {
      it('keeps a channel status as active', () => {
        let newChannel;

        return participants[1].webex.internal.board
          .createChannel(conversation)
          .then((res) => {
            newChannel = res;

            return participants[1].webex.internal.board.keepActive(newChannel);
          })
          .then(() =>
            assert.isRejected(
              participants[0].webex.internal.board.deleteChannel(conversation, newChannel, {
                preventDeleteActiveChannel: true,
              })
            )
          );
      });
    });
  });
});
