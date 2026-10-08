import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@spsedu360/shared-ui/src/components/atoms/tabs'
import React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@spsedu360/shared-ui/src/components/atoms/accordion'
import { useBuilderStore } from '@/store/useBuilderStore'
import { Input } from '@spsedu360/shared-ui/src/components/atoms/input'
import {
  AlignCenter,
  AlignHorizontalJustifyCenterIcon,
  AlignHorizontalJustifyEndIcon,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceAround,
  AlignHorizontalSpaceBetween,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  ChevronsLeftRightIcon,
  LucideImageDown,
} from 'lucide-react'
import { Label } from '@spsedu360/shared-ui/src/components/atoms/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@spsedu360/shared-ui/src/components/atoms/select'
import { Slider } from '@spsedu360/shared-ui/src/components/atoms/slider'

const ComponentStyling = () => {
  const { editorState, dispatch } = useBuilderStore()

  const handleChangeCustomValues = (e: any) => {
    const stylingProperty = e.target.id
    const value = e.target.value
      ? e.target.value
      : editorState.editor.selectedElement.content &&
          !Array.isArray(editorState.editor.selectedElement.content) &&
          editorState.editor.selectedElement.name === 'link'
        ? editorState.editor.selectedElement.content.href
        : e.target.value
    const styleObject = {
      [stylingProperty]: value,
    }

    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        elementDetails: {
          ...editorState.editor.selectedElement,
          content: {
            ...editorState.editor.selectedElement.content,
            ...styleObject,
          },
        },
      },
    })
  }

  const handleOnChanges = (e: any) => {
    const styleSettings = e.target.id
    const value = e.target.value
      ? e.target.value
      : editorState.editor.selectedElement.content &&
          !Array.isArray(editorState.editor.selectedElement.content) &&
          editorState.editor.selectedElement.name === 'link'
        ? editorState.editor.selectedElement.content.href
        : e.target.value
    const styleObject = {
      [styleSettings]: value,
    }

    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        elementDetails: {
          ...editorState.editor.selectedElement,
          styles: {
            ...editorState.editor.selectedElement.styles,
            ...styleObject,
          },
        },
      },
    })
  }

  return (
    <TabsContent
      value="component-styling"
      className=" h-full h-[90vh] overflow-y-auto"
    >
      <Accordion
        type="multiple"
        className="w-full overflow-y-auto"
        defaultValue={['Typography', 'Dimensions', 'Decorations', 'FlexBox']}
      >
        <AccordionItem value="Custom" className="px-6 py-0">
          <AccordionTrigger className="cursor-pointer !no-underline">
            Custom
          </AccordionTrigger>
          <AccordionContent>
            {editorState.editor.selectedElement.type === 'link' &&
              !Array.isArray(editorState.editor.selectedElement.content) && (
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground">Link Path</p>
                  <Input
                    id="href"
                    placeholder="https://domain.example.com/pathname"
                    onChange={handleChangeCustomValues}
                    value={editorState.editor.selectedElement.content.href}
                    className="cursor-pointer"
                  />
                </div>
              )}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="Typography" className="px-6 py-0 border-y-[1px]">
          <AccordionTrigger className="cursor-pointer !no-underline">
            TypoGraphy
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-2 ">
              <p className="text-muted-foreground">Text Align</p>
              <Tabs
                onValueChange={(e) =>
                  handleOnChanges({
                    target: {
                      id: 'textAlign',
                      value: e,
                    },
                  })
                }
                value={editorState.editor.selectedElement.styles.textAlign}
              >
                <TabsList className="flex items-center flex-row justify-between border-[1px] rounded-md bg-transparent h-fit gap-4">
                  <TabsTrigger
                    value="left"
                    className="w-10 h-10 p-0 cursor-pointer data-[state=active]:bg-muted"
                  >
                    <AlignLeft size={18} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="right"
                    className="w-10 h-10 p-0 cursor-pointer data-[state=active]:bg-muted"
                  >
                    <AlignRight size={18} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="center"
                    className="w-10 h-10 p-0 cursor-pointer data-[state=active]:bg-muted"
                  >
                    <AlignCenter size={18} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="justify"
                    className="w-10 h-10 p-0 cursor-pointer data-[state=active]:bg-muted "
                  >
                    <AlignJustify size={18} />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground">Font Family</p>
              <Input
                id="fontFamily"
                onChange={handleOnChanges}
                value={editorState.editor.selectedElement.styles.fontFamily}
                className="cursor-pointer"
              />
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">Size</Label>
                <Input
                  placeholder="px"
                  id="fontSize"
                  onChange={handleOnChanges}
                  value={editorState.editor.selectedElement.styles.fontSize}
                />
              </div>
            </div>
            <div className="flex gap-4 py-2">
              <Input
                className="h-4 w-4 cursor-pointer"
                placeholder="px"
                type="checkbox"
                id="fontStyle"
                checked={
                  editorState.editor.selectedElement.styles.fontStyle &&
                  editorState.editor.selectedElement.styles.fontStyle ===
                    'italic'
                }
                onChange={(va) => {
                  handleOnChanges({
                    target: {
                      id: 'fontStyle',
                      value: va.target.checked ? 'italic' : '',
                    },
                  })
                }}
              />
              <Label className="text-muted-foreground italic">Italic</Label>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground">Color</p>
              <Input
                id="color"
                onChange={handleOnChanges}
                value={editorState.editor.selectedElement.styles.color}
                className="cursor-pointer"
              />
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">Weight</Label>
                <Select
                  value={String(
                    editorState.editor.selectedElement?.styles?.fontWeight ||
                      '',
                  )}
                  onValueChange={(e) =>
                    handleOnChanges({
                      target: {
                        id: 'fontWeight',
                        value: e,
                      },
                    })
                  }
                >
                  <SelectTrigger className="w-[180px] cursor-pointer">
                    <SelectValue placeholder="Select a weight" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Font Weights</SelectLabel>
                      <SelectItem value="bold">Bold</SelectItem>
                      <SelectItem value="normal">Regular</SelectItem>
                      <SelectItem value="lighter">Light</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="Dimensions" className=" px-6 py-0 ">
          <AccordionTrigger className="cursor-pointer !no-underline">
            Dimensions
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex gap-4 flex-col">
                  <div className="flex gap-4">
                    <div>
                      <Label className="text-muted-foreground">Height</Label>
                      <Input
                        id="height"
                        placeholder="px"
                        onChange={handleOnChanges}
                        value={editorState.editor.selectedElement.styles.height}
                        className="cursor-pointer"
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Width</Label>
                      <Input
                        placeholder="px"
                        id="width"
                        onChange={handleOnChanges}
                        value={editorState.editor.selectedElement.styles.width}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
                <p>Margin px</p>
                <div className="flex gap-4 flex-col">
                  <div className="flex gap-4">
                    <div>
                      <Label className="text-muted-foreground">Top</Label>
                      <Input
                        id="marginTop"
                        placeholder="px"
                        onChange={handleOnChanges}
                        value={
                          editorState.editor.selectedElement.styles.marginTop
                        }
                        className="cursor-pointer"
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Bottom</Label>
                      <Input
                        placeholder="px"
                        id="marginBottom"
                        onChange={handleOnChanges}
                        value={
                          editorState.editor.selectedElement.styles.marginBottom
                        }
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <Label className="text-muted-foreground">Left</Label>
                      <Input
                        placeholder="px"
                        id="marginLeft"
                        onChange={handleOnChanges}
                        value={
                          editorState.editor.selectedElement.styles.marginLeft
                        }
                        className="cursor-pointer"
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Right</Label>
                      <Input
                        placeholder="px"
                        id="marginRight"
                        onChange={handleOnChanges}
                        value={
                          editorState.editor.selectedElement.styles.marginRight
                        }
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p>Padding px</p>
                <div className="flex gap-4 flex-col">
                  <div className="flex gap-4">
                    <div>
                      <Label className="text-muted-foreground">Top</Label>
                      <Input
                        placeholder="px"
                        id="paddingTop"
                        onChange={handleOnChanges}
                        value={
                          editorState.editor.selectedElement.styles.paddingTop
                        }
                        className="cursor-pointer"
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Bottom</Label>
                      <Input
                        placeholder="px"
                        id="paddingBottom"
                        onChange={handleOnChanges}
                        value={
                          editorState.editor.selectedElement.styles
                            .paddingBottom
                        }
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <Label className="text-muted-foreground">Left</Label>
                      <Input
                        placeholder="px"
                        id="paddingLeft"
                        onChange={handleOnChanges}
                        value={
                          editorState.editor.selectedElement.styles.paddingLeft
                        }
                        className="cursor-pointer"
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Right</Label>
                      <Input
                        placeholder="px"
                        id="paddingRight"
                        onChange={handleOnChanges}
                        value={
                          editorState.editor.selectedElement.styles.paddingRight
                        }
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="Decorations" className="px-6 py-0 ">
          <AccordionTrigger className="cursor-pointer !no-underline">
            Decorations
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4">
            <div>
              <Label className="text-muted-foreground">Opacity</Label>
              <div className="flex items-center justify-end">
                <small className="p-2">
                  {typeof editorState.editor.selectedElement.styles?.opacity ===
                  'number'
                    ? editorState.editor.selectedElement.styles?.opacity
                    : parseFloat(
                        (
                          editorState.editor.selectedElement.styles?.opacity ||
                          '0'
                        ).replace('%', ''),
                      ) || 0}
                  %
                </small>
              </div>
              <Slider
                className="cursor-pointer"
                value={[
                  typeof editorState.editor.selectedElement.styles?.opacity ===
                  'number'
                    ? editorState.editor.selectedElement.styles?.opacity
                    : parseFloat(
                        (
                          editorState.editor.selectedElement.styles?.opacity ||
                          '0'
                        ).replace('%', ''),
                      ) || 0,
                ]}
                onValueChange={(e) => {
                  handleOnChanges({
                    target: {
                      id: 'opacity',
                      value: `${e[0]}%`,
                    },
                  })
                }}
                defaultValue={[
                  typeof editorState.editor.selectedElement.styles?.opacity ===
                  'number'
                    ? editorState.editor.selectedElement.styles?.opacity
                    : parseFloat(
                        (
                          editorState.editor.selectedElement.styles?.opacity ||
                          '0'
                        ).replace('%', ''),
                      ) || 0,
                ]}
                max={100}
                step={1}
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Border Radius</Label>
              <div className="flex items-center justify-end">
                <small className="">
                  {typeof editorState.editor.selectedElement.styles
                    ?.borderRadius === 'number'
                    ? editorState.editor.selectedElement.styles?.borderRadius
                    : parseFloat(
                        (
                          editorState.editor.selectedElement.styles
                            ?.borderRadius || '0'
                        ).replace('px', ''),
                      ) || 0}
                  px
                </small>
              </div>
              <Slider
                className="cursor-pointer"
                value={[
                  typeof editorState.editor.selectedElement.styles
                    ?.borderRadius === 'number'
                    ? editorState.editor.selectedElement.styles?.borderRadius
                    : parseFloat(
                        (
                          editorState.editor.selectedElement.styles
                            ?.borderRadius || '0'
                        ).replace('%', ''),
                      ) || 0,
                ]}
                onValueChange={(e) => {
                  handleOnChanges({
                    target: {
                      id: 'borderRadius',
                      value: `${e[0]}px`,
                    },
                  })
                }}
                defaultValue={[
                  typeof editorState.editor.selectedElement.styles
                    ?.borderRadius === 'number'
                    ? editorState.editor.selectedElement.styles?.borderRadius
                    : parseFloat(
                        (
                          editorState.editor.selectedElement.styles
                            ?.borderRadius || '0'
                        ).replace('%', ''),
                      ) || 0,
                ]}
                max={100}
                step={1}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground">Background Color</Label>
              <div className="flex  border-[1px] rounded-md overflow-clip">
                <div
                  className="w-12 "
                  style={{
                    backgroundColor:
                      editorState.editor.selectedElement.styles.backgroundColor,
                  }}
                />
                <Input
                  placeholder="#HFI245"
                  className="!border-y-0  cursor-pointer rounded-none !border-r-0 mr-2"
                  id="backgroundColor"
                  onChange={handleOnChanges}
                  value={
                    editorState.editor.selectedElement.styles.backgroundColor
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground">Background Image</Label>
              <div className="flex  border-[1px] rounded-md overflow-clip">
                <div
                  className="w-12 "
                  style={{
                    backgroundImage:
                      editorState.editor.selectedElement.styles.backgroundImage,
                  }}
                />
                <Input
                  placeholder="url()"
                  className="!border-y-0 rounded-none cursor-pointer !border-r-0 mr-2"
                  id="backgroundImage"
                  onChange={handleOnChanges}
                  value={
                    editorState.editor.selectedElement.styles.backgroundImage
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground">Image Position</Label>
              <Tabs
                onValueChange={(e) =>
                  handleOnChanges({
                    target: {
                      id: 'backgroundSize',
                      value: e,
                    },
                  })
                }
                value={editorState.editor.selectedElement.styles.backgroundSize?.toString()}
              >
                <TabsList className="flex items-center flex-row justify-between border-[1px] rounded-md bg-transparent h-fit gap-4">
                  <TabsTrigger
                    value="cover"
                    className="w-10 h-10 p-0 cursor-pointer data-[state=active]:bg-muted"
                  >
                    <ChevronsLeftRightIcon size={18} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="contain"
                    className="w-10 h-10 p-0 cursor-pointer data-[state=active]:bg-muted"
                  >
                    <AlignVerticalJustifyCenter size={22} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="auto"
                    className="w-10 h-10 p-0 cursor-pointer data-[state=active]:bg-muted"
                  >
                    <LucideImageDown size={18} />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="Flexbox" className="px-1 py-0  ">
          <AccordionTrigger className="cursor-pointer !no-underline px-5">
            Flexbox
          </AccordionTrigger>
          <AccordionContent>
            <Label className="text-muted-foreground">Justify Content</Label>
            <Tabs
              onValueChange={(e) =>
                handleOnChanges({
                  target: {
                    id: 'justifyContent',
                    value: e,
                  },
                })
              }
              value={editorState.editor.selectedElement.styles.justifyContent}
            >
              <TabsList className="flex items-center flex-row justify-between border-[1px] rounded-md bg-transparent h-fit gap-4">
                <TabsTrigger
                  value="space-between"
                  className="w-10 h-10 p-0  cursor-pointer data-[state=active]:bg-muted"
                >
                  <AlignHorizontalSpaceBetween size={18} />
                </TabsTrigger>
                <TabsTrigger
                  value="space-evenly"
                  className="w-10 h-10 p-0  cursor-pointer data-[state=active]:bg-muted"
                >
                  <AlignHorizontalSpaceAround size={18} />
                </TabsTrigger>
                <TabsTrigger
                  value="center"
                  className="w-10 h-10 p-0 cursor-pointer data-[state=active]:bg-muted"
                >
                  <AlignHorizontalJustifyCenterIcon size={18} />
                </TabsTrigger>
                <TabsTrigger
                  value="start"
                  className="w-10 h-10 p-0 cursor-pointer data-[state=active]:bg-muted "
                >
                  <AlignHorizontalJustifyStart size={18} />
                </TabsTrigger>
                <TabsTrigger
                  value="end"
                  className="w-10 h-10 p-0 cursor-pointer data-[state=active]:bg-muted "
                >
                  <AlignHorizontalJustifyEndIcon size={18} />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Label className="text-muted-foreground">Align Items</Label>
            <Tabs
              onValueChange={(e) =>
                handleOnChanges({
                  target: {
                    id: 'alignItems',
                    value: e,
                  },
                })
              }
              value={editorState.editor.selectedElement.styles.alignItems}
            >
              <TabsList className="flex  items-center flex-row justify-between border-[1px] rounded-md bg-transparent h-fit gap-4">
                <TabsTrigger
                  value="center"
                  className="w-10 cursor-pointer h-10 p-0 data-[state=active]:bg-muted"
                >
                  <AlignVerticalJustifyCenter size={18} />
                </TabsTrigger>
                <TabsTrigger
                  value="normal"
                  className="w-10 h-10 p-0 cursor-pointer data-[state=active]:bg-muted "
                >
                  <AlignVerticalJustifyStart size={18} />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2 py-2">
              <Input
                className="h-4 w-4 cursor-pointer"
                placeholder="px"
                type="checkbox"
                id="display"
                onChange={(va) => {
                  handleOnChanges({
                    target: {
                      id: 'display',
                      value: va.target.checked ? 'flex' : 'block',
                    },
                  })
                }}
              />
              <Label className="text-muted-foreground">Flex</Label>
            </div>
            {editorState.editor.selectedElement.styles &&
              editorState.editor.selectedElement.styles.display === 'flex' && (
                <div className="flex items-center gap-2 py-2">
                  <Label className="text-muted-foreground"> Direction</Label>
                  {/* <Input
              placeholder="px"
              id="flexDirection"
              onChange={handleOnChanges}
              value={editorState.editor.selectedElement.styles.flexDirection}
            /> */}
                  <Select
                    onValueChange={(e) =>
                      handleOnChanges({
                        target: {
                          id: 'flexDirection',
                          value: e,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="w-[180px] cursor-pointer">
                      <SelectValue placeholder="Select a direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Flex Directions</SelectLabel>
                        <SelectItem value="flex-row">row</SelectItem>
                        <SelectItem value="flex-col">col</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </TabsContent>
  )
}

export default ComponentStyling
