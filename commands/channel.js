// commands/channel.js - Channel Forwarding
module.exports = {
    name: 'channel',
    category: 'Channel',
    description: 'Manage channel forwarding',
    ownerOnly: true,
    run: async (sock, msg, { args }) => {
        const senderJid = msg.key.remoteJid;
        
        if (!args[0]) {
            await sock.sendMessage(senderJid, {
                text: `📢 *CHANNEL FORWARDING*\n\n` +
                      `*Commands:*\n` +
                      `• .channel add <channel_link> - Add channel to forward\n` +
                      `• .channel remove <channel_link> - Remove channel\n` +
                      `• .channel list - List all channels\n` +
                      `• .channel target <number> - Set forwarding target\n` +
                      `• .channel status - Check forwarding status\n\n` +
                      `*Examples:*\n` +
                      `.channel add https://whatsapp.com/channel/xxxxx\n` +
                      `.channel target 254101579396`
            });
            return;
        }
        
        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'add': {
                if (!args[1]) {
                    await sock.sendMessage(senderJid, {
                        text: '❌ Please provide a channel link!\n\nExample: .channel add https://whatsapp.com/channel/xxxxx'
                    });
                    return;
                }
                
                const channelLink = args[1];
                global.channels = global.channels || [];
                
                if (global.channels.includes(channelLink)) {
                    await sock.sendMessage(senderJid, {
                        text: '⚠️ This channel is already being forwarded!'
                    });
                    return;
                }
                
                global.channels.push(channelLink);
                
                await sock.sendMessage(senderJid, {
                    text: `✅ Channel added successfully!\n\n📢 Channel: ${channelLink}\n\n📊 Total channels: ${global.channels.length}`
                });
                break;
            }
            
            case 'remove': {
                if (!args[1]) {
                    await sock.sendMessage(senderJid, {
                        text: '❌ Please provide a channel link!\n\nExample: .channel remove https://whatsapp.com/channel/xxxxx'
                    });
                    return;
                }
                
                const removeLink = args[1];
                global.channels = global.channels || [];
                
                const index = global.channels.indexOf(removeLink);
                if (index === -1) {
                    await sock.sendMessage(senderJid, {
                        text: '❌ Channel not found in the list!'
                    });
                    return;
                }
                
                global.channels.splice(index, 1);
                
                await sock.sendMessage(senderJid, {
                    text: `✅ Channel removed successfully!\n\n📢 Channel: ${removeLink}\n\n📊 Total channels: ${global.channels.length}`
                });
                break;
            }
            
            case 'list': {
                global.channels = global.channels || [];
                
                if (global.channels.length === 0) {
                    await sock.sendMessage(senderJid, {
                        text: '📭 No channels added yet!\n\nUse .channel add <channel_link> to add one.'
                    });
                    return;
                }
                
                let channelList = `📢 *Forwarding Channels:*\n\n`;
                global.channels.forEach((channel, i) => {
                    channelList += `${i + 1}. ${channel}\n`;
                });
                
                channelList += `\n📊 Total: ${global.channels.length} channel(s)`;
                
                await sock.sendMessage(senderJid, {
                    text: channelList
                });
                break;
            }
            
            case 'target': {
                if (!args[1]) {
                    await sock.sendMessage(senderJid, {
                        text: '❌ Please provide a target number!\n\nExample: .channel target 254101579396'
                    });
                    return;
                }
                
                global.targetNumber = args[1].replace(/[^0-9]/g, '');
                
                await sock.sendMessage(senderJid, {
                    text: `✅ Target number set to: ${global.targetNumber}`
                });
                break;
            }
            
            case 'status': {
                global.channels = global.channels || [];
                const statusText = `📢 *CHANNEL FORWARDING STATUS*\n\n` +
                                  `📊 Channels added: ${global.channels.length}\n` +
                                  `🎯 Target number: ${global.targetNumber || 'Not set'}\n` +
                                  `🔴 Status: ${global.channels.length > 0 && global.targetNumber ? 'ACTIVE ✅' : 'INACTIVE ❌'}\n\n` +
                                  (global.channels.length === 0 ? 'Add channels with .channel add <link>' : '') +
                                  (!global.targetNumber ? 'Set target with .channel target <number>' : '');
                
                await sock.sendMessage(senderJid, {
                    text: statusText
                });
                break;
            }
            
            default:
                await sock.sendMessage(senderJid, {
                    text: '❌ Unknown action!\n\nUse .channel help to see available commands.'
                });
        }
    }
};
